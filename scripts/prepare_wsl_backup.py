"""Create a verified encrypted migration snapshot and a private comparison receipt.

This does not activate WSL, restore private data into Linux, or change runtime ownership.
Run in a local interactive Windows terminal; the backup password is never persisted.
"""

import json
import os
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from workspace_fingerprint import fingerprint

from app.backup import default_tool, read_password
from app.db.store import read_identity
from app.services.backup_snapshot import DATABASE, BackupError, verify_snapshot
from app.services.encrypted_backup import ResticBackup


def prepare(database: Path, repository: Path, password: str) -> Path:
    backup = ResticBackup(default_tool(), repository, password)
    before = fingerprint(database)
    identity = read_identity(database)
    snapshot = backup.create(database)
    with tempfile.TemporaryDirectory(prefix=".oracle-migration-", dir=database.parent) as temporary:
        staging = Path(temporary)
        restored = staging / "verified"
        manifest = backup.restore(snapshot, restored, staging)
        if (fingerprint(restored / DATABASE) != before or fingerprint(database) != before
                or str(manifest.workspace_id) != identity or read_identity(database) != identity):
            raise BackupError("backup_source_changed")
        if verify_snapshot(restored) != manifest:
            raise BackupError("backup_checksum")
    # A new receipt for each attempt; an older success cannot masquerade as this run.
    receipt = database.parent / ("wsl-migration-" + str(uuid4()) + ".json")
    value = {"format": 1, "created_at": datetime.now(UTC).isoformat(), "snapshot": snapshot,
             "manifest": manifest.model_dump(mode="json"), "tables": before}
    with receipt.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())
    return receipt


def main() -> None:
    if os.name != "nt" or not sys.stdin.isatty():
        raise SystemExit("Use an interactive Windows terminal; never pass a password in arguments.")
    try:
        database = Path(os.environ["LOCALAPPDATA"]) / "local.oracle.desktop" / DATABASE
        repository = Path(os.environ["OneDrive"]) / "OracleBackups"
        print("Enter your existing backup password locally. Do not send it in chat.", flush=True)
        password = read_password(confirm=False)
        print("Creating and comparing a verified encrypted snapshot...", flush=True)
        receipt = prepare(database, repository, password)
        del password
        print(json.dumps({"ok": True, "receipt": receipt.name}))
        print("Backup verified locally. Oracle still uses Windows; no cutover was performed.")
    except (KeyboardInterrupt, EOFError):
        print(json.dumps({"ok": False, "error": "backup_cancelled"}))
        raise SystemExit(1) from None
    except BackupError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        raise SystemExit(1) from None
    except Exception:
        print(json.dumps({"ok": False, "error": "backup_failed"}))
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
