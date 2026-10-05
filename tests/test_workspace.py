import json
import sqlite3
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import text

from app.db import workspace
from app.db.store import WorkspaceError, existing_engine, identity_path, open_store, read_identity
from app.schemas.applications import ApplicationData, GetRequest, ListRequest, SaveRequest
from app.services.applications import RecordError, execute


def legacy(path):
    path.touch(exist_ok=False)
    engine = existing_engine(path)
    cfg = Config()
    cfg.set_main_option("script_location", str(Path(workspace.__file__).parent / "migrations"))
    with engine.begin() as connection:
        cfg.attributes["connection"] = connection
        command.upgrade(cfg, "0001")
    return engine


def test_missing_database_never_creates_files_even_with_credentials(tmp_path):
    path = tmp_path / "absent" / "oracle.sqlite3"
    for operation in (open_store, workspace.prepare_workspace):
        with pytest.raises(WorkspaceError, match="workspace_missing"):
            operation(path)
        assert not path.parent.exists()
    (tmp_path / "password.phc").write_text("credential sentinel")
    path = tmp_path / "oracle.sqlite3"
    result = subprocess.run(  # noqa: S603 -- fixed module, interpreter and synthetic test path
        [sys.executable, "-I", "-m", "app.desktop_bridge", str(path)],
        input=b'{"action":"list"}',
        capture_output=True,
        timeout=15,
        check=True,
    )
    assert json.loads(result.stdout) == {
        "protocol_version": 1,
        "ok": False,
        "error": "workspace_missing",
    }
    assert not path.exists()


def test_explicit_initialization_does_not_overwrite_and_paths_are_uri_safe(tmp_path):
    path = tmp_path / "Unicode Å # % & space.sqlite3"
    workspace.initialize_workspace(path).dispose()
    original = path.read_bytes()
    marker = identity_path(path).read_bytes()
    with pytest.raises(WorkspaceError, match="workspace_exists"):
        workspace.initialize_workspace(path)
    assert path.read_bytes() == original
    assert identity_path(path).read_bytes() == marker
    workspace.prepare_workspace(path)
    engine = open_store(path)
    assert execute(engine, ListRequest(action="list"))["total"] == 0
    engine.dispose()


def test_legacy_upgrade_preserves_records_and_creates_verified_recovery_copy(tmp_path):
    path = tmp_path / "oracle.sqlite3"
    legacy(path).dispose()
    identity, job = str(uuid4()), str(uuid4())
    # Written as the first release stored it; current models no longer fit the 0001 tables.
    with sqlite3.connect(path) as connection:
        connection.execute(
            "INSERT INTO jobs (id, title, company, website, source, learning, description) "
            "VALUES (?, '', 'Synthetic', '', '', '', '')",
            (job,),
        )
        connection.execute(
            "INSERT INTO applications (id, job_id, resume_sent, how_sent, references_sent, "
            "status_notes, interview, follow_up, notes, status, version, updated_at) VALUES "
            "(?, ?, '', '', '', '', '', '', 'Keep this history', 'Unspecified', 1, "
            "'2026-09-27T00:00:00+00:00')",
            (identity, job),
        )
    workspace.prepare_workspace(path)
    backups = list((tmp_path / "migration-backups").glob("*.sqlite3"))
    assert len(backups) == 1
    with sqlite3.connect(backups[0]) as copy:
        assert copy.execute("PRAGMA integrity_check").fetchone() == ("ok",)
        assert copy.execute("SELECT version_num FROM alembic_version").fetchone() == ("0001",)
        assert copy.execute("SELECT notes FROM applications").fetchone() == ("Keep this history",)
    marker = read_identity(path)
    workspace.prepare_workspace(path)
    assert read_identity(path) == marker
    assert len(list((tmp_path / "migration-backups").glob("*.sqlite3"))) == 1
    engine = open_store(path)
    saved = execute(engine, GetRequest(action="get", id=identity))
    assert (saved["version"], saved["updated_at"]) == (1, "2026-09-27T00:00:00+00:00")
    assert (
        saved["data"]
        == ApplicationData(company="Synthetic", notes="Keep this history").model_dump()
    )
    assert saved["imported"] is None and saved["listing_id"] is None
    engine.dispose()


@pytest.mark.parametrize("contents", [b"", b"not a sqlite database"])
def test_invalid_database_is_not_reinitialized(tmp_path, contents):
    path = tmp_path / "oracle.sqlite3"
    path.write_bytes(contents)
    with pytest.raises(WorkspaceError):
        workspace.prepare_workspace(path)
    assert path.read_bytes() == contents
    assert not identity_path(path).exists()


def test_unknown_schema_and_mismatched_identity_fail_closed(tmp_path):
    first = tmp_path / "first.sqlite3"
    second = tmp_path / "second.sqlite3"
    for path in (first, second):
        workspace.initialize_workspace(path).dispose()
    marker = identity_path(first).read_bytes()
    identity_path(first).write_bytes(identity_path(second).read_bytes())
    with pytest.raises(WorkspaceError, match="workspace_identity"):
        open_store(first)
    identity_path(first).write_bytes(marker)
    with sqlite3.connect(first) as connection:
        connection.execute("UPDATE alembic_version SET version_num = '9999'")
    before = first.read_bytes()
    for operation in (open_store, workspace.prepare_workspace):
        with pytest.raises(WorkspaceError, match="workspace_schema"):
            operation(first)
    assert first.read_bytes() == before


def test_missing_marker_is_not_silently_recreated(tmp_path):
    path = tmp_path / "oracle.sqlite3"
    workspace.initialize_workspace(path).dispose()
    identity_path(path).unlink()
    with pytest.raises(WorkspaceError, match="workspace_identity"):
        workspace.prepare_workspace(path)
    assert not identity_path(path).exists()


def test_database_removed_after_engine_creation_is_not_recreated(tmp_path):
    path = tmp_path / "oracle.sqlite3"
    engine = workspace.initialize_workspace(path)
    path.rename(tmp_path / "moved.sqlite3")
    with pytest.raises(WorkspaceError, match="workspace_unavailable"):
        execute(engine, ListRequest(action="list"))
    assert not path.exists()
    engine.dispose()


def test_reads_do_not_reserve_writer_slot_and_never_run_migrations(tmp_path, monkeypatch):
    path = tmp_path / "oracle.sqlite3"
    workspace.initialize_workspace(path).dispose()

    def forbidden(*_args, **_kwargs):
        raise AssertionError("Ordinary data access must not run Alembic")

    monkeypatch.setattr(command, "upgrade", forbidden)
    engine = open_store(path)
    with engine.connect() as reader:
        reader.execute(text("SELECT count(*) FROM applications"))
        other = sqlite3.connect(path, timeout=0.05)
        try:
            other.execute("BEGIN IMMEDIATE")
            other.rollback()
        finally:
            other.close()
    assert execute(engine, ListRequest(action="list"))["total"] == 0
    engine.dispose()


def test_two_concurrent_edits_keep_stale_version_protection(tmp_path):
    path = tmp_path / "oracle.sqlite3"
    engine = workspace.initialize_workspace(path)
    saved = execute(
        engine,
        SaveRequest(
            action="create", id=uuid4(), version=0, data=ApplicationData(company="Example")
        ),
    )
    engine.dispose()

    def edit(note):
        separate = open_store(path)
        try:
            return execute(
                separate,
                SaveRequest(
                    action="update",
                    id=saved["id"],
                    version=1,
                    data=ApplicationData(company="Example", notes=note),
                ),
            )["version"]
        except RecordError as exc:
            return str(exc)
        finally:
            separate.dispose()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(edit, ["first", "second"]))
    assert results.count(2) == 1 and results.count("conflict") == 1


@pytest.mark.parametrize("stage", ["snapshot", "migration"])
def test_failed_maintenance_preserves_legacy_schema_and_records(tmp_path, monkeypatch, stage):
    path = tmp_path / "oracle.sqlite3"
    legacy(path).dispose()

    def fail(*args):
        if stage == "migration":
            args[0].exec_driver_sql("CREATE TABLE interrupted (id INTEGER)")
        raise OSError("Synthetic failure")

    monkeypatch.setattr(workspace, "migration_snapshot" if stage == "snapshot" else "migrate", fail)
    with pytest.raises(OSError, match="Synthetic"):
        workspace.prepare_workspace(path)
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT version_num FROM alembic_version").fetchone() == ("0001",)
        assert (
            connection.execute("SELECT name FROM sqlite_master WHERE name='interrupted'").fetchone()
            is None
        )
    assert not identity_path(path).exists()
