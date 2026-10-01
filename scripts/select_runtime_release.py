"""Select an installed Linux release without moving or replacing any workspace data."""

import argparse
import csv
import io
import json
import os
import re
import subprocess
from pathlib import Path
from uuid import UUID, uuid4

CHECK = """
import hashlib,json,os,sys
from pathlib import Path
import app
from app.db.store import open_store
from app.wsl_worker import private_workspace
config=json.loads(sys.argv[1])
release=Path(config['project'])
assert release.resolve()==release and not (release/'install.pending').exists()
assert release.stat().st_uid==os.getuid() and release.stat().st_mode & 0o077 == 0
receipt=json.loads((release/'release.json').read_bytes())
raw=(json.dumps(receipt['manifest'],sort_keys=True,indent=2)+'\\n').encode()
assert receipt['release']==release.name==hashlib.sha256(raw).hexdigest()
assert Path(sys.prefix)==release/'.venv'
assert Path(app.__file__).resolve().is_relative_to(release/'.venv')
database=Path(config['database'])
private_workspace(database,config['workspace_id'])
open_store(database).dispose()
print(json.dumps({'ok':True}))
"""


def select_release(directory: Path, release: str, verify) -> Path:
    if not re.fullmatch(r"[0-9a-f]{64}", release):
        raise ValueError("Expected a release digest")
    if (directory / "runtime-transition.pending").exists():
        raise RuntimeError("Resolve the pending workspace transition first")
    if not (directory / "runtime-wsl.selected").is_file():
        raise RuntimeError("An existing selected Linux workspace is required")
    path = directory / "runtime.json"
    original = path.read_bytes()
    if len(original) > 4096:
        raise ValueError("Invalid configuration")
    config = json.loads(original)
    if (
        set(config)
        != {"version", "runtime", "distribution", "user", "project", "database", "workspace_id"}
        or config["version"] not in (1, 2)
        or config["runtime"] != "wsl"
        or config["distribution"] != "Ubuntu"
        or not re.fullmatch(r"[a-z][a-z0-9_-]{0,31}", config["user"])
        or str(UUID(config["workspace_id"])) != config["workspace_id"]
    ):
        raise ValueError("Invalid configuration")
    home = f"/home/{config['user']}"
    prefix = f"{home}/.local/share/oracle/runtime/releases/"
    if config["database"] != f"{home}/.local/share/oracle/oracle.sqlite3":
        raise ValueError("Unexpected workspace")
    if config["version"] == 1:
        if config["project"] != f"{home}/projects/oracle":
            raise ValueError("Unexpected development runtime")
    elif not config["project"].startswith(prefix) or not re.fullmatch(
        r"[0-9a-f]{64}", config["project"][len(prefix) :]
    ):
        raise ValueError("Unexpected installed runtime")
    selected = {**config, "version": 2, "project": prefix + release}
    verify(selected)  # Must verify the installed package and existing workspace before publication.
    if path.read_bytes() != original:
        raise RuntimeError("Runtime configuration changed during verification")
    if config == selected:
        return path
    backup = directory / f"runtime-config-before-{uuid4()}.json"
    with backup.open("xb") as stream:
        stream.write(original)
        stream.flush()
        os.fsync(stream.fileno())
    temporary = directory / f"runtime-release-{uuid4()}.tmp"
    try:
        with temporary.open("x", encoding="utf-8") as stream:
            json.dump(selected, stream, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
    return backup


def main() -> None:
    if os.name != "nt":
        raise SystemExit("Run runtime selection on Windows after closing Oracle")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("release")
    args = parser.parse_args()
    system = Path(os.environ["SystemRoot"]) / "System32"
    result = subprocess.run(  # noqa: S603 -- fixed process inventory
        [
            str(system / "tasklist.exe"),
            "/FI",
            "IMAGENAME eq oracle-desktop.exe",
            "/FO",
            "CSV",
            "/NH",
        ],
        capture_output=True,
        check=True,
        timeout=10,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    if any(
        row and row[0].lower() == "oracle-desktop.exe"
        for row in csv.reader(io.StringIO(result.stdout.decode(errors="replace")))
    ):
        raise RuntimeError("Close Oracle before selecting a runtime release")

    def verify(config):
        result = subprocess.run(  # noqa: S603 -- canonical installed interpreter, fixed check code
            [
                str(system / "wsl.exe"),
                "--distribution",
                "Ubuntu",
                "--user",
                config["user"],
                "--exec",
                config["project"] + "/.venv/bin/python",
                "-I",
                "-c",
                CHECK,
                json.dumps(config),
            ],
            capture_output=True,
            check=True,
            timeout=40,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        if json.loads(result.stdout) != {"ok": True}:
            raise RuntimeError("Installed runtime verification failed")

    directory = Path(os.environ["LOCALAPPDATA"]) / "local.oracle.desktop"
    select_release(directory, args.release, verify)
    print(json.dumps({"ok": True, "release": args.release, "workspace_moved": False}))


if __name__ == "__main__":
    main()
