"""Promote a verified Linux stage into a new private runtime directory only."""

import argparse
import json
import os
import shutil
import stat
import sys
from pathlib import Path

from app.services.backup_snapshot import FILES, BackupError, flush_file, verify_snapshot
from app.wsl_worker import private_workspace


def promote(value: dict, staging: Path, target: Path) -> None:
    from stage_wsl_restore import validate_receipt
    from workspace_fingerprint import fingerprint

    expected = validate_receipt(value)
    source = staging / ("restored-" + value["snapshot"])
    if (
        sys.platform != "linux"
        or source.resolve() != source
        or target.resolve() != target
        or target.parts[1] in {"mnt", "media", "run", "proc", "sys", "dev"}
    ):
        raise BackupError("migration_path_invalid")
    private_workspace(source / "oracle.sqlite3", str(expected.workspace_id))
    if (
        verify_snapshot(source) != expected
        or fingerprint(source / "oracle.sqlite3") != value["tables"]
    ):
        raise BackupError("migration_comparison_failed")
    parent = target.parent.stat()
    if not stat.S_ISDIR(parent.st_mode) or parent.st_uid != os.getuid() or parent.st_mode & 0o022:
        raise BackupError("migration_parent_permissions")
    # Exclusive directory and file creation; an interrupted prior attempt is never overwritten.
    target.mkdir(mode=0o700)
    for name in FILES:
        with (source / name).open("rb") as incoming, (target / name).open("xb") as outgoing:
            shutil.copyfileobj(incoming, outgoing)
        (target / name).chmod(0o600)
        flush_file(target / name)
    private_workspace(target / "oracle.sqlite3", str(expected.workspace_id))
    if (
        verify_snapshot(target) != expected
        or fingerprint(target / "oracle.sqlite3") != value["tables"]
    ):
        raise BackupError("migration_comparison_failed")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipt", required=True, type=Path)
    args = parser.parse_args()
    try:
        with args.receipt.open("rb") as stream:
            raw = stream.read(65537)
        if len(raw) > 65536:
            raise BackupError("migration_receipt_invalid")
        parent = Path.home() / ".local/share"
        promote(json.loads(raw), parent / "oracle-migration", parent / "oracle")
        print(json.dumps({"ok": True, "promoted": True}))
    except Exception:
        print(json.dumps({"ok": False, "error": "migration_promotion_failed"}))
        raise SystemExit(1) from None


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    main()
