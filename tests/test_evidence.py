import json
import os
import sqlite3
import subprocess
import sys
from uuid import uuid4

import pytest
from pydantic import ValidationError
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.store import SCHEMA_VERSION, identity_path, open_store
from app.db.workspace import initialize_workspace, prepare_workspace
from app.models.documents import SourceDocument
from app.models.evidence import DocumentText
from app.schemas.evidence import Citation, DraftEvidence, DraftPayload
from app.schemas.profile import CandidateData
from app.services.backup_snapshot import (
    DATABASE,
    MANIFEST,
    digest,
    snapshot_workspace,
    verify_snapshot,
)
from app.services.documents import import_documents, read_document
from app.services.evidence import EvidenceError, extract_document, get_draft, store_draft
from app.services.profile import get_profile


def text_pdf(path, text="Synthetic Candidate", *, encrypted=False):
    writer = PdfWriter()
    page = writer.add_blank_page(width=300, height=300)
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
    )
    stream = DecodedStreamObject()
    stream.set_data(f"BT /F1 12 Tf 10 100 Td ({text}) Tj ET".encode("ascii"))
    page[NameObject("/Contents")] = stream
    if encrypted:
        writer.encrypt("")
    writer.write(path)
    return path


@pytest.fixture
def source(tmp_path):
    engine = initialize_workspace(tmp_path / DATABASE)
    document = read_document("cv", text_pdf(tmp_path / "synthetic.pdf", encrypted=True))
    identity = import_documents(engine, [document])[0]
    try:
        yield engine, identity, document
    finally:
        engine.dispose()


def proposal(identity):
    return DraftPayload(
        data=CandidateData(full_name="Synthetic Candidate"),
        evidence=[
            DraftEvidence(
                target="full_name",
                citations=[Citation(document_id=identity, page=1, excerpt="Synthetic Candidate")],
            )
        ],
    )


def test_extraction_draft_and_snapshot_preserve_original_and_active_profile(source, tmp_path):
    engine, identity, original = source
    assert get_draft(engine).draft is None
    assert extract_document(engine, identity) == 1
    with Session(engine) as session:
        created = session.get(DocumentText, identity).created_at
    assert extract_document(engine, identity) == 1
    draft = store_draft(engine, proposal(identity))
    assert store_draft(engine, proposal(identity)) == draft == get_draft(engine)
    assert draft.draft.status == "unreviewed"
    assert draft.draft.method == "assisted_import"
    assert get_profile(engine).version == 0
    with Session(engine) as session:
        extracted = session.get(DocumentText, identity)
        assert extracted.created_at == created
        assert extracted.source_sha256 == original.sha256
        assert json.loads(extracted.pages) == ["Synthetic Candidate"]
        assert session.scalar(select(SourceDocument.content)) == original.content
    target = tmp_path / "snapshot"
    snapshot_workspace(tmp_path / DATABASE, target)
    verify_snapshot(target)
    restored = open_store(target / DATABASE)
    try:
        assert get_draft(restored) == draft
        assert get_profile(restored).version == 0
        with Session(restored) as session:
            assert json.loads(session.get(DocumentText, identity).pages) == ["Synthetic Candidate"]
    finally:
        restored.dispose()


@pytest.mark.parametrize("change", ["missing", "page", "fabricated", "blank", "changed"])
def test_invalid_citations_never_create_a_draft(source, change):
    engine, identity, _ = source
    extract_document(engine, identity)
    draft = proposal(identity)
    citation = draft.evidence[0].citations[0]
    if change == "missing":
        citation.document_id = uuid4()
    elif change == "page":
        citation.page = 2
    elif change == "fabricated":
        citation.excerpt = "Unmentioned qualification"
    elif change == "blank":
        citation.excerpt = "   "
    else:
        with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
            session.get(DocumentText, identity).source_sha256 = "0" * 64
    with pytest.raises(EvidenceError):
        store_draft(engine, draft)
    assert get_draft(engine).draft is None
    assert get_profile(engine).version == 0


def test_existing_draft_is_not_silently_replaced(source):
    engine, identity, _ = source
    extract_document(engine, identity)
    original = store_draft(engine, proposal(identity))
    changed = proposal(identity)
    changed.warnings.append("Requires review")
    with pytest.raises(EvidenceError, match="draft_exists"):
        store_draft(engine, changed)
    assert get_draft(engine) == original


@pytest.mark.parametrize("change", ["missing", "extra", "duplicate", "preferences", "oversized"])
def test_draft_requires_complete_bounded_evidence_and_no_inferred_preferences(change):
    data = proposal(str(uuid4())).model_dump(mode="json")
    if change == "missing":
        data["data"]["headline"] = "Uncited claim"
    elif change == "extra":
        data["evidence"][0]["target"] = "education/unknown"
    elif change == "duplicate":
        data["evidence"] *= 2
    elif change == "preferences":
        data["data"]["preferences"]["target_roles"] = ["Inferred role"]
    else:
        data["evidence"][0]["citations"][0]["excerpt"] = "x" * 6001
    with pytest.raises(ValidationError):
        DraftPayload.model_validate_json(json.dumps(data))


def test_no_text_does_not_create_extraction(source, tmp_path):
    engine, _, _ = source
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    path = tmp_path / "blank.pdf"
    writer.write(path)
    identity = import_documents(engine, [read_document("certificate", path)])[0]
    with pytest.raises(EvidenceError, match="source_no_text"):
        extract_document(engine, identity)
    with Session(engine) as session:
        assert session.get(DocumentText, identity) is None


def test_worker_read_contract_and_sanitized_errors(source, tmp_path):
    engine, identity, _ = source
    extract_document(engine, identity)
    draft = store_draft(engine, proposal(identity))
    for request, expected in [
        (
            {"action": "profile_draft_get"},
            {"protocol_version": 1, "ok": True, "result": draft.model_dump(mode="json")},
        ),
        (
            {"action": "profile_draft_get", "path": "private sentinel"},
            {"protocol_version": 1, "ok": False, "error": "invalid"},
        ),
    ]:
        result = subprocess.run(  # noqa: S603 -- fixed worker, synthetic workspace
            [sys.executable, "-I", "-m", "app.desktop_bridge", str(tmp_path / DATABASE)],
            input=json.dumps(request).encode(),
            capture_output=True,
            timeout=15,
            check=True,
        )
        assert not result.stderr
        assert json.loads(result.stdout) == expected


def test_previous_profile_snapshot_verifies_unchanged_then_upgrades(tmp_path):
    database = tmp_path / DATABASE
    initialize_workspace(database).dispose()
    target = tmp_path / "snapshot"
    snapshot_workspace(database, target)
    old = target / DATABASE
    with sqlite3.connect(old) as connection:
        connection.execute("ALTER TABLE applications DROP COLUMN deadline_date")
        connection.execute("ALTER TABLE applications DROP COLUMN follow_up_date")
        connection.execute("DROP TABLE listing_searches")
        connection.execute("DROP TABLE job_listings")
        connection.execute("DROP TABLE background_tasks")
        connection.execute("DROP TABLE document_versions")
        connection.execute("DROP TABLE profile_review")
        connection.execute("DROP TABLE profile_draft")
        connection.execute("DROP TABLE document_text")
        connection.execute("UPDATE alembic_version SET version_num = '0004'")
    manifest_path = target / MANIFEST
    manifest = json.loads(manifest_path.read_text())
    manifest["schema_revision"] = "0004"
    manifest["files"][DATABASE] = digest(old).model_dump()
    manifest_path.write_text(json.dumps(manifest))
    before, marker = old.read_bytes(), identity_path(old).read_bytes()
    assert verify_snapshot(target).schema_revision == "0004"
    assert old.read_bytes() == before
    prepare_workspace(old)
    assert identity_path(old).read_bytes() == marker
    with sqlite3.connect(old) as connection:
        assert connection.execute("SELECT version_num FROM alembic_version").fetchone() == (
            SCHEMA_VERSION,
        )
    assert len(list((target / "migration-backups").glob("*.sqlite3"))) == 1


def test_disposable_worker_memory_cap_is_enforced():
    code = """
from app.pdf_limits import limit_worker_memory, MEMORY_LIMIT
limit_worker_memory()
try:
    bytearray(MEMORY_LIMIT * 2)
except MemoryError:
    print('limited')
"""
    result = subprocess.run(  # noqa: S603 -- fixed code, bounded child-only allocation
        [sys.executable, "-I", "-c", code],
        capture_output=True,
        timeout=15,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        check=True,
    )
    assert result.stdout.strip() == b"limited"


def test_encrypted_backup_restores_draft_and_pages(source, tmp_path, tmp_path_factory):
    from app.backup import default_tool
    from app.services.backup_snapshot import BackupError
    from app.services.encrypted_backup import ResticBackup

    try:
        tool = default_tool()
    except BackupError:
        pytest.skip("Verified restic tool is required")
    engine, identity, _ = source
    extract_document(engine, identity)
    expected = store_draft(engine, proposal(identity))
    backup = ResticBackup(
        tool,
        tmp_path_factory.mktemp("evidence-repository") / "encrypted",
        "Synthetic evidence backup password only",
    )
    backup.initialize()
    snapshot = backup.create(tmp_path / DATABASE)
    backup.restore(snapshot, tmp_path / "restored", tmp_path)
    restored = open_store(tmp_path / "restored" / DATABASE)
    try:
        assert get_draft(restored) == expected
        assert get_profile(restored).version == 0
        with Session(restored) as session:
            assert json.loads(session.get(DocumentText, identity).pages) == ["Synthetic Candidate"]
    finally:
        restored.dispose()


@pytest.mark.parametrize(
    "contents",
    [b"not json", b'{"private sentinel":true}', b"x" * 524289],
    ids=["malformed", "unknown-field", "oversized"],
)
def test_draft_cli_rejects_invalid_input_without_private_output_or_initializing(tmp_path, contents):
    input_path = tmp_path / "synthetic.json"
    input_path.write_bytes(contents)
    database = tmp_path / "absent.sqlite3"
    result = subprocess.run(  # noqa: S603 -- fixed CLI with synthetic input
        [
            sys.executable,
            "-I",
            "-m",
            "app.profile_draft",
            "import",
            "--database",
            str(database),
            "--input",
            str(input_path),
        ],
        capture_output=True,
        timeout=15,
        check=False,
    )
    assert result.returncode == 1
    assert not result.stderr
    assert json.loads(result.stdout) == {"ok": False, "error": "draft_invalid"}
    assert not database.exists()
