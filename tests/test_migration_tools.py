import importlib
import json
import shutil
import sqlite3
from pathlib import Path

import pytest

from app.db.workspace import initialize_workspace
from app.services.backup_snapshot import BackupError, snapshot_workspace, verify_snapshot


@pytest.fixture
def tools(monkeypatch):
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1] / "scripts"))
    return importlib.import_module("prepare_wsl_backup")


def test_fingerprint_compares_types_bytes_and_duplicate_rows(tools, tmp_path):
    database = tmp_path / "synthetic.sqlite3"
    connection = sqlite3.connect(database)
    try:
        connection.execute('CREATE TABLE "odd""name" (value)')
        connection.executemany(
            'INSERT INTO "odd""name" VALUES (?)', [(1,), ("1",), (b"1",), (None,), (1,)]
        )
        connection.commit()
        before = tools.fingerprint(database)
        assert next(iter(before.values()))["rows"] == 5
        connection.execute(
            'UPDATE "odd""name" SET value=? WHERE typeof(value)=?', (b"changed PDF bytes", "blob")
        )
        connection.commit()
        assert tools.fingerprint(database) != before
        connection.execute('DELETE FROM "odd""name" WHERE typeof(value)=?', ("integer",))
        connection.commit()
        assert next(iter(tools.fingerprint(database).values()))["rows"] == 3
    finally:
        connection.close()


@pytest.mark.parametrize("change", [False, True])
def test_migration_receipt_requires_unchanged_source(tools, tmp_path, monkeypatch, change):
    database = tmp_path / "oracle.sqlite3"
    initialize_workspace(database).dispose()
    frozen = tmp_path / "frozen"

    class FakeBackup:
        def __init__(self, *_args):
            pass

        def create(self, source):
            snapshot_workspace(source, frozen)
            if change:
                connection = sqlite3.connect(source)
                try:
                    connection.execute("CREATE TABLE extra (value TEXT)")
                    connection.commit()
                finally:
                    connection.close()
            return "a" * 64

        def restore(self, _snapshot, target, _staging):
            shutil.copytree(frozen, target)
            return verify_snapshot(target)

    monkeypatch.setattr(tools, "ResticBackup", FakeBackup)
    monkeypatch.setattr(tools, "default_tool", lambda: tmp_path / "unused-tool")
    if change:
        with pytest.raises(BackupError, match="backup_source_changed"):
            tools.prepare(database, tmp_path / "repo", "synthetic receipt test password")
        assert not list(tmp_path.glob("wsl-migration-*.json"))
    else:
        receipt = tools.prepare(database, tmp_path / "repo", "synthetic receipt test password")
        value = json.loads(receipt.read_text())
        assert value["snapshot"] == "a" * 64
        assert value["tables"] == tools.fingerprint(database)
        assert "password" not in receipt.read_text()
    assert not list(tmp_path.glob(".oracle-migration-*"))


@pytest.mark.skipif(__import__("sys").platform != "linux", reason="Linux staging boundary")
def test_staging_rejects_shared_or_mismatched_workspace(tools, tmp_path):
    from datetime import UTC, datetime

    staging = importlib.import_module("stage_wsl_restore")
    source = tmp_path / "source"
    source.mkdir()
    database = source / "oracle.sqlite3"
    initialize_workspace(database).dispose()
    manifest = snapshot_workspace(database, tmp_path / "frozen")
    receipt = {
        "format": 1,
        "created_at": datetime.now(UTC).isoformat(),
        "snapshot": "a" * 64,
        "manifest": manifest.model_dump(mode="json"),
        "tables": tools.fingerprint(database),
    }
    parent = tmp_path / "stage"
    parent.mkdir(mode=0o700)

    class FakeBackup:
        def restore(self, _snapshot, target, _staging):
            shutil.copytree(tmp_path / "frozen", target)
            for path in [target, *target.iterdir()]:
                path.chmod(0o700 if path.is_dir() else 0o600)
            return manifest

    parent.chmod(0o755)
    with pytest.raises(BackupError, match="permissions"):
        staging.stage(receipt, FakeBackup(), parent)
    assert list(parent.iterdir()) == []
    parent.chmod(0o700)
    receipt["tables"] = {}
    with pytest.raises(BackupError, match="comparison_failed"):
        staging.stage(receipt, FakeBackup(), parent)
    assert not (tmp_path / "oracle.sqlite3").exists()
    receipt["snapshot"] = "../escape"
    with pytest.raises(BackupError, match="receipt_invalid"):
        staging.stage(receipt, FakeBackup(), parent)


@pytest.mark.parametrize("failure", [None, "promote", "changed"])
def test_activation_preserves_rollback_and_blocks_interrupted_cutover(tools, tmp_path, failure):
    from app.db.store import read_identity

    activation = importlib.import_module("activate_wsl_runtime")
    database = tmp_path / "oracle.sqlite3"
    initialize_workspace(database).dispose()
    credential = tmp_path / "password.phc"
    credential.write_text("synthetic credential sentinel")
    receipt = {
        "manifest": {"workspace_id": read_identity(database)},
        "tables": tools.fingerprint(database),
        "snapshot": "a" * 64,
    }

    def promote():
        if failure == "promote":
            raise RuntimeError("synthetic interrupted promotion")
        if failure == "changed":
            connection = sqlite3.connect(database)
            try:
                connection.execute("CREATE TABLE changed(value TEXT)")
                connection.commit()
            finally:
                connection.close()

    if failure:
        with pytest.raises(RuntimeError):
            activation.activate(tmp_path, receipt, promote)
        assert database.exists()
        assert (tmp_path / "runtime-transition.pending").exists()
        assert not (tmp_path / "runtime.json").exists()
    else:
        rollback = activation.activate(tmp_path, receipt, promote)
        assert not database.exists()
        assert tools.fingerprint(rollback / "oracle.sqlite3") == receipt["tables"]
        assert not (rollback / "password.phc").exists()
        assert (tmp_path / "runtime-wsl.selected").exists()
        assert not (tmp_path / "runtime-transition.pending").exists()
        assert json.loads((tmp_path / "runtime.json").read_text())["runtime"] == "wsl"
        with pytest.raises(RuntimeError):
            activation.activate(tmp_path, receipt, promote)
    assert credential.read_text() == "synthetic credential sentinel"


@pytest.mark.skipif(__import__("sys").platform != "linux", reason="Linux promotion")
def test_promotion_preserves_stage_and_refuses_existing_target(tools, tmp_path):
    from datetime import UTC, datetime

    promotion = importlib.import_module("promote_wsl_workspace")
    database = tmp_path / "oracle.sqlite3"
    initialize_workspace(database).dispose()
    staging = tmp_path / "stage"
    staging.mkdir(mode=0o700)
    source = staging / ("restored-" + "a" * 64)
    manifest = snapshot_workspace(database, source)
    for path in source.iterdir():
        path.chmod(0o600)
    receipt = {
        "format": 1,
        "created_at": datetime.now(UTC).isoformat(),
        "snapshot": "a" * 64,
        "manifest": manifest.model_dump(mode="json"),
        "tables": tools.fingerprint(database),
    }
    target = tmp_path / "runtime"
    promotion.promote(receipt, staging, target)
    assert verify_snapshot(target) == manifest
    assert verify_snapshot(source) == manifest
    assert all(not path.stat().st_mode & 0o077 for path in [target, *target.iterdir()])
    with pytest.raises(FileExistsError):
        promotion.promote(receipt, staging, target)
    assert verify_snapshot(target) == manifest
