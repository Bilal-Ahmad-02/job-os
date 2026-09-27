import json
import os
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest
from pypdf import PdfWriter
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.backup import default_tool
from app.db.store import WorkspaceError, identity_path, open_store
from app.db.workspace import initialize_workspace
from app.models.documents import SourceDocument
from app.schemas.applications import ApplicationData, GetRequest, SaveRequest
from app.services.applications import execute
from app.services.backup_snapshot import (
    DATABASE,
    FILES,
    MANIFEST,
    BackupError,
    snapshot_workspace,
    verify_snapshot,
)
from app.services.documents import import_documents, read_document
from app.services.encrypted_backup import ResticBackup

PASSWORD = "synthetic backup test passphrase only"  # noqa: S105 -- disposable synthetic repositories


def workspace(parent):
    parent.mkdir()
    path = parent / DATABASE
    engine = initialize_workspace(path)
    saved = execute(
        engine,
        SaveRequest(
            action="create",
            id=uuid4(),
            version=0,
            data=ApplicationData(
                company="Synthetic only", notes="Preserve this private-looking test record"
            ),
        ),
    )
    engine.dispose()
    (parent / "password.phc").write_text("never included")
    return path, saved


def test_consistent_snapshot_includes_wal_and_excludes_credentials(tmp_path):
    database, saved = workspace(tmp_path / "source")
    with sqlite3.connect(database) as wal:
        assert wal.execute("PRAGMA journal_mode=WAL").fetchone() == ("wal",)
        wal.execute("UPDATE applications SET notes = 'Uncheckpointed synthetic record'")
        wal.commit()
        original = database.read_bytes()
        target = tmp_path / "snapshot"
        manifest = snapshot_workspace(database, target)
        assert database.read_bytes() == original
        assert set(p.name for p in target.iterdir()) == set(FILES)
        assert manifest == verify_snapshot(target)
        assert str(manifest.workspace_id) == identity_path(database).read_text().strip()
        engine = open_store(target / DATABASE)
        try:
            restored = execute(engine, GetRequest(action="get", id=saved["id"]))
            assert restored["data"]["notes"] == "Uncheckpointed synthetic record"
        finally:
            engine.dispose()


@pytest.mark.parametrize("failure", ["checksum", "path", "schema", "extra", "identity"])
def test_snapshot_validation_rejects_corruption_and_unknown_scope(tmp_path, failure):
    database, _ = workspace(tmp_path / "source")
    target = tmp_path / "snapshot"
    snapshot_workspace(database, target)
    manifest = json.loads((target / MANIFEST).read_text())
    if failure == "checksum":
        manifest["files"][DATABASE]["sha256"] = "0" * 64
    elif failure == "path":
        manifest["files"]["../escape"] = manifest["files"][DATABASE]
    elif failure == "schema":
        manifest["schema_revision"] = "9999"
    elif failure == "extra":
        (target / "unexpected.txt").write_text("not authorized")
    else:
        manifest["workspace_id"] = str(uuid4())
    (target / MANIFEST).write_text(json.dumps(manifest))
    with pytest.raises(BackupError):
        verify_snapshot(target)
    assert not (tmp_path / "escape").exists()


def test_missing_or_mismatched_workspace_never_produces_success(tmp_path):
    with pytest.raises(BackupError, match="source_missing"):
        snapshot_workspace(tmp_path / "missing.sqlite3", tmp_path / "snapshot")
    assert not (tmp_path / "snapshot").exists()
    database, _ = workspace(tmp_path / "source")
    identity_path(database).write_text(str(uuid4()) + "\n")
    with pytest.raises(WorkspaceError):
        snapshot_workspace(database, tmp_path / "snapshot")
    assert not (tmp_path / "snapshot").exists()


@pytest.fixture(scope="module")
def encrypted_repository(tmp_path_factory):
    explicit = os.environ.get("ORACLE_TEST_RESTIC")
    if explicit:
        tool = Path(explicit)
    else:
        try:
            tool = default_tool()
        except BackupError:
            pytest.skip(
                "Install the verified restic tool or set ORACLE_TEST_RESTIC for integration tests"
            )
    root = tmp_path_factory.mktemp("encrypted-oracle")
    database, saved = workspace(root / "source")
    source_pdf = root / "synthetic.pdf"
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    writer.write(source_pdf)
    engine = open_store(database)
    try:
        import_documents(engine, [read_document("cv", source_pdf)])
    finally:
        engine.dispose()
    repository = root / "encrypted"
    backup = ResticBackup(tool, repository, PASSWORD)
    backup.initialize()
    first = backup.create(database)
    engine = open_store(database)
    try:
        changed = execute(
            engine,
            SaveRequest(
                action="update",
                id=saved["id"],
                version=1,
                data=ApplicationData(company="Second version"),
            ),
        )
    finally:
        engine.dispose()
    second = backup.create(database)
    return backup, database, first, second, saved, changed


def test_encrypted_round_trip_retains_versions_and_checks_repository(
    encrypted_repository, tmp_path, monkeypatch
):
    backup, database, first, second, saved, changed = encrypted_repository
    monkeypatch.setenv("RESTIC_PASSWORD_COMMAND", "must never be executed")
    monkeypatch.setenv("RESTIC_PASSWORD", "wrong inherited password")
    before = database.read_bytes()
    assert {item["id"] for item in backup.snapshots()} == {first, second}
    backup.check()
    for identifier, expected in ((first, saved), (second, changed)):
        target = tmp_path / identifier
        backup.restore(identifier, target, tmp_path)
        engine = open_store(target / DATABASE)
        try:
            assert execute(engine, GetRequest(action="get", id=expected["id"])) == expected
            with Session(engine) as session:
                restored_pdf = session.scalar(select(SourceDocument.content))
            assert restored_pdf == (database.parent.parent / "synthetic.pdf").read_bytes()
        finally:
            engine.dispose()
        assert set(p.name for p in target.iterdir()) == set(FILES)
    assert database.read_bytes() == before
    assert not list(database.parent.glob(".oracle-backup-*"))
    assert not list(tmp_path.glob(".oracle-restore-*"))


def test_wrong_key_and_existing_restore_target_fail_closed(encrypted_repository, tmp_path):
    backup, database, first, *_ = encrypted_repository
    wrong = ResticBackup(backup.executable, backup.repository, "incorrect synthetic passphrase")
    with pytest.raises(BackupError, match="command_failed"):
        wrong.restore(first, tmp_path / "target", tmp_path)
    assert not (tmp_path / "target").exists()
    with pytest.raises(BackupError, match="target_exists"):
        backup.restore(first, database.parent, tmp_path)
    with pytest.raises(BackupError, match="snapshot_id"):
        backup.restore("../escape", tmp_path / "target", tmp_path)
    assert not (tmp_path / "target").exists()
    with pytest.raises(BackupError, match="repository_exists"):
        backup.initialize()


def test_tampered_encrypted_data_is_detected(encrypted_repository, tmp_path):
    backup, *_ = encrypted_repository
    repository = tmp_path / "corrupted"
    shutil.copytree(backup.repository, repository)
    pack = next(path for path in (repository / "data").rglob("*") if path.is_file())
    contents = bytearray(pack.read_bytes())
    contents[len(contents) // 2] ^= 1
    pack.write_bytes(contents)
    with pytest.raises(BackupError, match="command_failed"):
        ResticBackup(backup.executable, repository, PASSWORD).check()


def test_unavailable_destination_and_interrupted_snapshot_never_claim_success(
    encrypted_repository, tmp_path, monkeypatch
):
    backup, database, *_ = encrypted_repository
    missing = ResticBackup(backup.executable, tmp_path / "missing-parent" / "repo", PASSWORD)
    with pytest.raises(BackupError, match="destination_missing"):
        missing.initialize()
    with pytest.raises(BackupError, match="destination_missing"):
        missing.create(database)
    existing = backup.snapshots()

    def disk_failure(_path):
        raise OSError("synthetic disk-full failure")

    monkeypatch.setattr("app.services.backup_snapshot.flush_file", disk_failure)
    with pytest.raises(OSError):
        backup.create(database)
    assert backup.snapshots() == existing
    assert not list(database.parent.glob(".oracle-backup-*"))


@pytest.mark.parametrize("failure", ["timeout", "size"])
def test_tool_output_and_runtime_are_bounded(tmp_path, monkeypatch, failure):
    real_popen = subprocess.Popen
    program = "import time; time.sleep(20)" if failure == "timeout" else "print('x' * 10000)"

    def fake_tool(_arguments, **kwargs):
        # Use the base interpreter, avoiding Windows venv launcher child processes.
        return real_popen([sys._base_executable, "-I", "-c", program], **kwargs)

    monkeypatch.setattr("app.services.encrypted_backup.subprocess.Popen", fake_tool)
    backup = ResticBackup(Path(sys.executable), tmp_path / "repo", PASSWORD)
    with pytest.raises(BackupError, match=failure):
        backup._run(["check"], limit=100, timeout=0.5)


def test_plaintext_staging_is_rejected_in_known_onedrive_roots(
    encrypted_repository, tmp_path, monkeypatch
):
    backup, _, first, *_ = encrypted_repository
    monkeypatch.setenv("OneDrive", str(tmp_path))
    database, _ = workspace(tmp_path / "synced-source")
    with pytest.raises(BackupError, match="plaintext_sync_folder"):
        backup.create(database)
    with pytest.raises(BackupError, match="plaintext_sync_folder"):
        backup.restore(first, tmp_path / "recovery", tmp_path)
    assert not (tmp_path / "recovery").exists()


def test_cli_errors_do_not_print_private_details(tmp_path, monkeypatch, capsys):
    from app import backup as cli

    monkeypatch.setattr(sys, "argv", ["backup", "list", "--repository", str(tmp_path)])
    monkeypatch.setattr(sys.stdin, "isatty", lambda: True)
    monkeypatch.setattr(cli, "default_tool", lambda: Path(sys.executable))
    monkeypatch.setattr(cli.getpass, "getpass", lambda _prompt: PASSWORD)

    def failure(_self):
        raise RuntimeError("private-path-and-password-sentinel")

    monkeypatch.setattr(ResticBackup, "snapshots", failure)
    with pytest.raises(SystemExit, match="1"):
        cli.main()
    output = capsys.readouterr().out
    assert "backup_failed" in output
    assert "private-path-and-password-sentinel" not in output
    assert PASSWORD not in output


def test_local_password_prompt_retries_without_echoing_input(monkeypatch, capsys):
    from app import backup as cli

    answers = iter(["short", PASSWORD, "different confirmation", PASSWORD, PASSWORD])
    monkeypatch.setattr(cli.getpass, "getpass", lambda _prompt: next(answers))
    assert cli.read_password(confirm=True) == PASSWORD
    output = capsys.readouterr().out
    assert "20-128 characters" in output
    assert "did not match" in output
    assert PASSWORD not in output
    assert "different confirmation" not in output
