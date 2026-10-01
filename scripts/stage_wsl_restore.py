"""Interactive Linux staging only. Never changes the active desktop or its database."""

import argparse
import json
import os
import stat
import sys
from datetime import datetime
from pathlib import Path

from app.backup import default_tool, read_password
from app.services.backup_snapshot import DATABASE, BackupError, SnapshotManifest
from app.services.encrypted_backup import SNAPSHOT_ID, ResticBackup


def validate_receipt(value: dict) -> SnapshotManifest:
    if (not isinstance(value, dict) or set(value) !=
            {"format", "created_at", "snapshot", "manifest", "tables"}
            or type(value["format"]) is not int or value["format"] != 1
            or not isinstance(value["snapshot"], str)
            or not SNAPSHOT_ID.fullmatch(value["snapshot"])
            or not isinstance(value["tables"], dict)
            or datetime.fromisoformat(value["created_at"]).tzinfo is None):
        raise BackupError("migration_receipt_invalid")
    return SnapshotManifest.model_validate_json(json.dumps(value["manifest"]))


def stage(value: dict, backup: ResticBackup, parent: Path) -> Path:
    from workspace_fingerprint import fingerprint

    expected = validate_receipt(value)
    if (sys.platform != "linux" or not parent.is_absolute() or parent.resolve() != parent
            or parent.parts[1] in {"mnt", "media", "run", "proc", "sys", "dev"}):
        raise BackupError("migration_staging_invalid")
    info = parent.stat(follow_symlinks=False)
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise BackupError("migration_staging_permissions")
    target = parent / ("restored-" + value["snapshot"])
    previous = os.umask(0o077)
    try:
        actual = backup.restore(value["snapshot"], target, parent)
    finally:
        os.umask(previous)
    if actual != expected or fingerprint(target / DATABASE) != value["tables"]:
        raise BackupError("migration_comparison_failed")
    if target.stat().st_mode & 0o077 or any(p.stat().st_mode & 0o077 for p in target.iterdir()):
        raise BackupError("migration_staging_permissions")
    return target


def main() -> None:
    if sys.platform != "linux" or not sys.stdin.isatty():
        raise SystemExit("Use an interactive Linux terminal; never pass a password in arguments.")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--repository", type=Path, required=True)
    args = parser.parse_args()
    try:
        with args.receipt.open("rb") as stream:
            raw = stream.read(65537)
        if len(raw) > 65536:
            raise BackupError("migration_receipt_invalid")
        value = json.loads(raw)
        validate_receipt(value)
        parent = Path.home() / ".local/share/oracle-migration"
        parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        print("Enter the existing backup password locally to restore into private Linux staging.")
        password = read_password(confirm=False)
        backup = ResticBackup(default_tool(), args.repository, password)
        del password
        stage(value, backup, parent)
        print(json.dumps({"ok": True, "staged": True, "activated": False}))
        print("Every table and the complete snapshot manifest match. Windows remains active.")
    except (KeyboardInterrupt, EOFError):
        print(json.dumps({"ok": False, "error": "backup_cancelled"}))
        raise SystemExit(1) from None
    except BackupError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        raise SystemExit(1) from None
    except Exception:
        print(json.dumps({"ok": False, "error": "migration_staging_failed"}))
        raise SystemExit(1) from None


if __name__ == "__main__":
    # Isolated interpreter: add only this fixed, trusted maintenance-script directory.
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    main()
