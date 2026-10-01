"""Explicit Windows cutover after verified backup/restore; never used by the renderer."""

import argparse
import csv
import io
import json
import os
import stat
import subprocess
from pathlib import Path
from uuid import UUID, uuid4

from workspace_fingerprint import fingerprint

from app.db.store import read_identity


def write_new(path: Path, value: dict) -> None:
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, indent=2)
        stream.flush()
        os.fsync(stream.fileno())


def activate(directory: Path, receipt: dict, promote) -> Path:
    directory = directory.resolve(strict=True)
    database = directory / "oracle.sqlite3"
    identity = receipt["manifest"]["workspace_id"]
    if str(UUID(identity)) != identity:
        raise ValueError("Invalid workspace identity")
    for name in ("runtime.json", "runtime-wsl.selected", "runtime-transition.pending"):
        if (directory / name).exists():
            raise RuntimeError("Runtime already selected or transition requires recovery")
    if read_identity(database) != identity or fingerprint(database) != receipt["tables"]:
        raise RuntimeError("Windows workspace changed after the verified backup")
    if not (directory / "password.phc").is_file():
        raise RuntimeError("Existing Windows credentials are required")
    rollback = directory / ("rollback-before-wsl-" + str(uuid4()))
    pending = directory / "runtime-transition.pending"
    journal = {"format": 1, "rollback": rollback.name, "snapshot": receipt["snapshot"]}
    write_new(pending, journal)
    # Any failure from here leaves the marker. The updated desktop refuses to
    # open either workspace until the interrupted transition is reviewed.
    promote()
    if read_identity(database) != identity or fingerprint(database) != receipt["tables"]:
        raise RuntimeError("Windows workspace changed during staging")
    rollback.mkdir()
    for name in (
        "oracle.sqlite3",
        "oracle.workspace-id",
        "oracle.sqlite3-wal",
        "oracle.sqlite3-shm",
        "oracle.sqlite3-journal",
    ):
        source = directory / name
        if source.exists():
            if source.is_symlink() or not source.is_file():
                raise RuntimeError("Unexpected workspace file")
            source.rename(rollback / name)
    if fingerprint(rollback / "oracle.sqlite3") != receipt["tables"]:
        raise RuntimeError("Rollback comparison failed")
    for path in rollback.iterdir():
        path.chmod(stat.S_IREAD)
    config = {
        "version": 1,
        "runtime": "wsl",
        "distribution": "Ubuntu",
        "user": "lethargic",
        "project": "/home/lethargic/projects/oracle",
        "database": "/home/lethargic/.local/share/oracle/oracle.sqlite3",
        "workspace_id": identity,
    }
    temporary = directory / ("runtime-" + str(uuid4()) + ".tmp")
    write_new(temporary, config)
    temporary.rename(directory / "runtime.json")
    write_new(directory / "runtime-wsl.selected", journal)
    pending.unlink()
    return rollback


def main() -> None:
    if os.name != "nt":
        raise SystemExit("Run activation on Windows after closing Oracle")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--receipt", type=Path, required=True)
    args = parser.parse_args()
    try:
        system = Path(os.environ["SystemRoot"]) / "System32"
        processes = subprocess.run(  # noqa: S603 -- fixed Windows process inventory
            [
                str(system / "tasklist.exe"),
                "/FI",
                "IMAGENAME eq oracle-desktop.exe",
                "/FO",
                "CSV",
                "/NH",
            ],
            capture_output=True,
            timeout=10,
            check=True,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        if any(
            row and row[0].lower() == "oracle-desktop.exe"
            for row in csv.reader(io.StringIO(processes.stdout.decode(errors="replace")))
        ):
            raise RuntimeError("Close Oracle before activation")
        directory = Path(os.environ["LOCALAPPDATA"]) / "local.oracle.desktop"
        if args.receipt.resolve().parent != directory.resolve():
            raise RuntimeError("Receipt must remain in private Windows app data")
        with args.receipt.open("rb") as stream:
            raw = stream.read(65537)
        if len(raw) > 65536:
            raise RuntimeError("Invalid receipt")
        receipt = json.loads(raw)
        path = args.receipt.resolve()
        linux_receipt = "/mnt/" + path.drive[0].lower() + path.as_posix()[2:]

        def promote() -> None:
            result = subprocess.run(  # noqa: S603 -- fixed Linux promotion script and receipt
                [
                    str(system / "wsl.exe"),
                    "--distribution",
                    "Ubuntu",
                    "--user",
                    "lethargic",
                    "--exec",
                    "/home/lethargic/projects/oracle/.venv/bin/python",
                    "-I",
                    "/home/lethargic/projects/oracle/scripts/promote_wsl_workspace.py",
                    "--receipt",
                    linux_receipt,
                ],
                capture_output=True,
                timeout=40,
                check=True,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            if json.loads(result.stdout) != {"ok": True, "promoted": True}:
                raise RuntimeError("Linux promotion was not verified")

        activate(directory, receipt, promote)
        print(json.dumps({"ok": True, "runtime": "wsl", "windows_rollback_preserved": True}))
    except Exception:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "migration_activation_failed",
                    "instruction": "Keep Oracle closed and review the transition marker.",
                }
            )
        )
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
