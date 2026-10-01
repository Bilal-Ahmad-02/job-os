import hashlib
import json
import sqlite3
from dataclasses import replace

import pytest
from pypdf import PdfWriter
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.store import SCHEMA_VERSION, identity_path, open_store
from app.db.workspace import initialize_workspace, prepare_workspace
from app.models.documents import SourceDocument
from app.services.backup_snapshot import (
    DATABASE,
    MANIFEST,
    digest,
    snapshot_workspace,
    verify_snapshot,
)
from app.services.documents import DocumentError, import_documents, list_documents, read_document


def pdf(path, password=None):
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    if password is not None:
        writer.encrypt(password)
    writer.write(path)
    return path


@pytest.mark.parametrize("password", [None, ""])
def test_probe_preserves_original_including_openable_encryption(tmp_path, password):
    path = pdf(tmp_path / "source.pdf", password)
    original = path.read_bytes()
    document = read_document("cv", path)
    assert document.content == original == path.read_bytes()
    assert document.page_count == 1
    assert document.sha256 == hashlib.sha256(original).hexdigest()


def test_probe_rejects_password_protected_malformed_and_oversized_files(tmp_path):
    locked = pdf(tmp_path / "locked.pdf", "synthetic password")
    malformed = tmp_path / "malformed.pdf"
    malformed.write_bytes(b"%PDF-1.7\nnot a PDF")
    large = tmp_path / "large.pdf"
    large.write_bytes(b"%PDF-" + b"x" * (10 * 1024 * 1024))
    for path in (locked, malformed, large):
        with pytest.raises(DocumentError, match="document_invalid"):
            read_document("cv", path)


def test_import_is_idempotent_atomic_and_metadata_only(tmp_path):
    database = tmp_path / DATABASE
    engine = initialize_workspace(database)
    document = read_document("cv", pdf(tmp_path / "source.pdf"))
    try:
        identifiers = import_documents(engine, [document])
        assert import_documents(engine, [document]) == identifiers
        with pytest.raises(DocumentError, match="kind_conflict"):
            import_documents(engine, [replace(document, kind="certificate")])
        altered = replace(document, content=document.content + b"\n")
        altered = replace(altered, sha256=hashlib.sha256(altered.content).hexdigest())
        with pytest.raises(DocumentError, match="kind_conflict"):
            import_documents(engine, [altered, replace(document, kind="transcript")])
        with pytest.raises(DocumentError, match="invalid"):
            import_documents(engine, [replace(document, content=b"tampered")])
        result = list_documents(engine).model_dump(mode="json")
        assert len(result["items"]) == 1
        item = result["items"][0]
        assert item["id"] == identifiers[0]
        assert item["filename"] == "source.pdf"
        assert item["evidence_status"] == "source_only"
        assert "content" not in item and "path" not in item
        with Session(engine) as session:
            assert session.scalar(select(SourceDocument.content)) == document.content
    finally:
        engine.dispose()
    target = tmp_path / "snapshot"
    snapshot_workspace(database, target)
    verify_snapshot(target)
    restored = open_store(target / DATABASE)
    try:
        with Session(restored) as session:
            assert session.scalar(select(SourceDocument.content)) == document.content
    finally:
        restored.dispose()


def test_old_snapshot_verifies_without_mutation_then_explicitly_upgrades(tmp_path):
    database = tmp_path / DATABASE
    initialize_workspace(database).dispose()
    target = tmp_path / "snapshot"
    snapshot_workspace(database, target)
    old = target / DATABASE
    # Model the previously shipped schema, before document/profile tables existed.
    with sqlite3.connect(old) as connection:
        connection.execute("DROP TABLE background_tasks")
        connection.execute("DROP TABLE document_versions")
        connection.execute("DROP TABLE profile_review")
        connection.execute("DROP TABLE profile_draft")
        connection.execute("DROP TABLE document_text")
        connection.execute("DROP TABLE candidate_profile")
        connection.execute("DROP TABLE source_documents")
        connection.execute("UPDATE alembic_version SET version_num = '0002'")
    manifest_path = target / MANIFEST
    manifest = json.loads(manifest_path.read_text())
    manifest["schema_revision"] = "0002"
    manifest["files"][DATABASE] = digest(old).model_dump()
    manifest_path.write_text(json.dumps(manifest))
    before = old.read_bytes()
    marker = identity_path(old).read_bytes()
    assert verify_snapshot(target).schema_revision == "0002"
    assert old.read_bytes() == before
    prepare_workspace(old)
    assert identity_path(old).read_bytes() == marker
    with sqlite3.connect(old) as connection:
        assert connection.execute("SELECT version_num FROM alembic_version").fetchone() == (
            SCHEMA_VERSION,
        )
        assert connection.execute("SELECT COUNT(*) FROM source_documents").fetchone() == (0,)
    copies = list((target / "migration-backups").glob("*.sqlite3"))
    assert len(copies) == 1
    with sqlite3.connect(copies[0]) as connection:
        assert connection.execute("SELECT version_num FROM alembic_version").fetchone() == ("0002",)
