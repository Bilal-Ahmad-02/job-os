import json
import sqlite3
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session
from test_evidence import proposal, text_pdf

from app.db.store import SCHEMA_VERSION, WorkspaceError, open_store
from app.db.workspace import initialize_workspace, prepare_workspace, validate_contents
from app.models.documents import SourceDocument
from app.schemas.profile import CandidateData
from app.schemas.review import ReviewSaveRequest
from app.services.backup_snapshot import (
    DATABASE,
    MANIFEST,
    digest,
    snapshot_workspace,
    verify_snapshot,
)
from app.services.documents import DocumentError, import_documents, list_documents, read_document
from app.services.evidence import extract_document, get_draft, store_draft
from app.services.review import get_review, save_review


@pytest.fixture
def workspace(tmp_path):
    engine = initialize_workspace(tmp_path / DATABASE)
    documents = [
        read_document("cv", text_pdf(tmp_path / f"source-{n}.pdf", f"Synthetic Candidate {n}"))
        for n in range(3)
    ]
    try:
        yield engine, documents
    finally:
        engine.dispose()


def test_new_versions_preserve_exact_originals_citations_and_approved_profile(workspace, tmp_path):
    engine, documents = workspace
    first = import_documents(engine, [documents[0]])[0]
    extract_document(engine, first)
    draft = store_draft(engine, proposal(first))
    state = get_review(engine)
    approved = save_review(
        engine,
        ReviewSaveRequest(
            action="profile_review_save",
            version=0,
            profile_version=0,
            draft_sha256=state.draft_sha256,
            target="full_name",
            decision="approved",
            data=CandidateData(full_name="Synthetic Candidate"),
        ),
    )
    second = import_documents(engine, [documents[1]], replaces=first)[0]
    third = import_documents(engine, [documents[2]], replaces=second)[0]
    assert import_documents(engine, [documents[1]], replaces=first) == [second]
    assert import_documents(engine, [documents[2]], replaces=third) == [third]
    items = sorted(list_documents(engine).items, key=lambda item: item.version)
    assert [str(item.id) for item in items] == [first, second, third]
    assert [item.version for item in items] == [1, 2, 3]
    assert [item.is_latest for item in items] == [False, False, True]
    assert [str(item.family_id) for item in items] == [first] * 3
    assert [str(item.previous_id) if item.previous_id else None for item in items] == [
        None,
        first,
        second,
    ]
    with Session(engine) as session:
        for identity, document in zip((first, second, third), documents, strict=True):
            assert session.get(SourceDocument, identity).content == document.content
    assert get_draft(engine) == draft
    assert get_review(engine) == approved
    snapshot_workspace(tmp_path / DATABASE, tmp_path / "backup")
    verify_snapshot(tmp_path / "backup")
    restored = open_store(tmp_path / "backup" / DATABASE)
    try:
        assert list_documents(restored) == list_documents(engine)
        assert get_review(restored) == approved
    finally:
        restored.dispose()


@pytest.mark.parametrize(
    "failure",
    ["stale", "different-kind", "other-family", "missing", "bad-id", "batch", "older-bytes"],
)
def test_invalid_replacements_leave_every_version_unchanged(workspace, failure, tmp_path):
    engine, documents = workspace
    first = import_documents(engine, [documents[0]])[0]
    second = import_documents(engine, [documents[1]], replaces=first)[0]
    other = import_documents(engine, [documents[2]])[0]
    before = list_documents(engine)
    cases = {
        "stale": ([documents[2]], first),
        "different-kind": ([replace(documents[2], kind="certificate")], second),
        "other-family": ([documents[2]], second),
        "missing": ([documents[2]], str(uuid4())),
        "bad-id": ([documents[2]], "not-a-uuid"),
        "batch": ([documents[1], documents[2]], second),
        "older-bytes": ([documents[0]], second),
    }
    batch, parent = cases[failure]
    if failure == "stale":
        batch = [read_document("cv", text_pdf(tmp_path / "new-update.pdf", "Another update"))]
    with pytest.raises(DocumentError):
        import_documents(engine, batch, replaces=parent)
    assert list_documents(engine) == before
    assert other != first


def test_filenames_do_not_infer_relationships_and_batch_failure_rolls_back(workspace):
    engine, documents = workspace
    first = import_documents(engine, [documents[0]])[0]
    second = import_documents(engine, [replace(documents[1], filename=documents[0].filename)])[0]
    before = list_documents(engine)
    assert {str(item.family_id) for item in before.items} == {first, second}
    with pytest.raises(DocumentError):
        import_documents(engine, [documents[2], replace(documents[0], kind="transcript")])
    assert list_documents(engine) == before


def test_concurrent_replacements_have_one_winner_and_no_branch(workspace):
    engine, documents = workspace
    first = import_documents(engine, [documents[0]])[0]

    def replace_one(document):
        try:
            return import_documents(engine, [document], replaces=first)[0]
        except DocumentError as exc:
            return str(exc)

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(replace_one, documents[1:]))
    assert results.count("document_version_conflict") == 1
    assert len(list_documents(engine).items) == 2


def test_schema_six_snapshot_restores_without_mutation_and_backfills_version_one(
    workspace, tmp_path
):
    engine, documents = workspace
    original = import_documents(engine, [documents[0]])[0]
    snapshot_workspace(tmp_path / DATABASE, tmp_path / "backup")
    old = tmp_path / "backup" / DATABASE
    with sqlite3.connect(old) as connection:
        connection.execute("DROP TABLE job_listings")
        connection.execute("DROP TABLE background_tasks")
        connection.execute("DROP TABLE document_versions")
        connection.execute("UPDATE alembic_version SET version_num = '0006'")
    manifest_path = old.parent / MANIFEST
    manifest = json.loads(manifest_path.read_text())
    manifest["schema_revision"] = "0006"
    manifest["files"][DATABASE] = digest(old).model_dump()
    manifest_path.write_text(json.dumps(manifest))
    before = old.read_bytes()
    assert verify_snapshot(old.parent).schema_revision == "0006"
    assert old.read_bytes() == before
    prepare_workspace(old)
    restored = open_store(old)
    try:
        item = list_documents(restored).items[0]
        assert str(item.id) == str(item.family_id) == original
        assert item.version == 1 and item.is_latest and item.previous_id is None
        with Session(restored) as session:
            assert session.get(SourceDocument, original).content == documents[0].content
    finally:
        restored.dispose()


def test_missing_lineage_fails_workspace_validation(workspace):
    engine, documents = workspace
    import_documents(engine, [documents[0]])
    with engine.connect().execution_options(oracle_write=True) as connection, connection.begin():
        connection.exec_driver_sql("DELETE FROM document_versions")
    with engine.connect() as connection, pytest.raises(WorkspaceError, match="workspace_invalid"):
        validate_contents(connection, SCHEMA_VERSION)


def test_cli_replacement_and_retry_use_explicit_ids_without_printing_private_content(
    workspace, tmp_path
):
    engine, documents = workspace
    first = import_documents(engine, [documents[0]])[0]
    results = []
    for _ in range(2):
        result = subprocess.run(  # noqa: S603 -- fixed local importer and synthetic paths
            [
                sys.executable,
                "-I",
                "-m",
                "app.import_documents",
                "--database",
                str(tmp_path / DATABASE),
                "--cv",
                str(tmp_path / "source-1.pdf"),
                "--replaces",
                first,
            ],
            capture_output=True,
            timeout=20,
            check=True,
        )
        assert not result.stderr
        payload = json.loads(result.stdout)
        assert payload["ok"] and payload["documents"] == 1
        assert set(payload) == {"ok", "documents", "document_ids"}
        assert b"Synthetic Candidate" not in result.stdout
        results.append(payload)
    assert results[0] == results[1]
    assert len(list_documents(engine).items) == 2
