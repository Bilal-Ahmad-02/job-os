"""Interactive local backup maintenance. Never invoke this through the renderer."""

import argparse
import getpass
import hashlib
import json
import os
import platform
import sys
from pathlib import Path

from app.services.backup_snapshot import BackupError
from app.services.encrypted_backup import ResticBackup, validate_password

RESTIC_VERSION = "0.19.1"
RESTIC_WINDOWS_SHA256 = "b0dd1fd21eea5d8fe1325f55f7118213c21f36de8a261e04c0624a5ab9fd7830"
RESTIC_LINUX_SHA256 = "20d4142678d0d95ec11a4759def1b73fd9190abc9ca19e4b62d067c0b387e639"


def read_password(*, confirm: bool) -> str:
    while True:
        password = getpass.getpass("Backup password: ")
        try:
            validate_password(password)
        except BackupError:
            print("Use 20-128 characters with no line breaks. Try a passphrase of several words.")
            continue
        if confirm and password != getpass.getpass("Confirm backup password: "):
            print("The two entries did not match. Enter your backup password again.")
            continue
        return password


def default_tool() -> Path:
    if os.name == "nt":
        filename = f"restic_{RESTIC_VERSION}_windows_amd64.exe"
        expected = RESTIC_WINDOWS_SHA256
    elif sys.platform == "linux" and platform.machine() == "x86_64":
        filename = f"restic_{RESTIC_VERSION}_linux_amd64"
        expected = RESTIC_LINUX_SHA256
    else:
        raise BackupError("backup_tool_missing")
    path = (
        Path(__file__).resolve().parents[2]
        / ".cache"
        / "tools"
        / f"restic-{RESTIC_VERSION}"
        / filename
    )
    if not path.is_file():
        raise BackupError("backup_tool_missing")
    with path.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != expected:
            raise BackupError("backup_tool_checksum")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description="Encrypted Oracle backup and staged recovery.")
    parser.add_argument(
        "operation", choices=("setup", "init", "create", "list", "check", "restore")
    )
    parser.add_argument(
        "--repository", type=Path, required=True, help="Local encrypted repository folder"
    )
    parser.add_argument("--database", type=Path, help="Current private Oracle database")
    parser.add_argument("--snapshot", help="Full snapshot ID to restore; never a guessed 'latest'")
    parser.add_argument(
        "--target", type=Path, help="New private recovery directory; never overwritten"
    )
    parser.add_argument("--staging", type=Path, help="Existing private staging parent for restore")
    parser.add_argument(
        "--restic", type=Path, help="Explicit trusted restic executable (default: verified cache)"
    )
    args = parser.parse_args()
    if args.operation in ("setup", "create") and args.database is None:
        parser.error("--database is required for setup/create")
    if args.operation == "restore" and not all((args.snapshot, args.target, args.staging)):
        parser.error("restore requires --snapshot, --target, and --staging")
    if not sys.stdin.isatty():
        parser.error(
            "Use an interactive local terminal; do not pipe or pass a password as an argument."
        )
    try:
        tool = args.restic if args.restic is not None else default_tool()
        print(
            "Enter your separate backup password locally. "
            "Keep it in an independent password manager."
        )
        password = read_password(confirm=args.operation in ("setup", "init"))
        backup = ResticBackup(tool, args.repository, password)
        del password
        result: dict = {"ok": True, "operation": args.operation}
        if args.operation in ("setup", "init"):
            backup.initialize()
        if args.operation in ("setup", "create"):
            print("Creating an encrypted snapshot and checking that it restores correctly...")
            result["snapshot"] = backup.create(args.database)
        if args.operation in ("setup", "check"):
            backup.check()
        if args.operation == "list":
            result["snapshots"] = backup.snapshots()
        if args.operation == "restore":
            backup.restore(args.snapshot, args.target, args.staging)
            result["staged_restore_ready"] = True
        print(json.dumps(result))
        if args.operation in ("setup", "create"):
            print(
                "Encrypted copy verified locally. Confirm OneDrive has finished syncing "
                "before relying on off-device recovery."
            )
    except BackupError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        raise SystemExit(1) from None
    except (KeyboardInterrupt, EOFError):
        print(json.dumps({"ok": False, "error": "backup_cancelled"}))
        raise SystemExit(1) from None
    except Exception:
        # Never expose raw restic output, local paths, database records or secrets.
        print(json.dumps({"ok": False, "error": "backup_failed"}))
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
