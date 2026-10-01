"""Opt-in Windows-to-WSL pipe smoke check. Uses a disposable synthetic workspace only."""

import argparse
import json
import os
import subprocess
from pathlib import PurePosixPath
from uuid import uuid4

SETUP = """
import json,sys,tempfile
from pathlib import Path
from app.db.workspace import initialize_workspace
parent=Path(sys.argv[1])/'.cache'
parent.mkdir(exist_ok=True)
folder=Path(tempfile.mkdtemp(prefix='oracle-wsl-bridge-',dir=parent))
initialize_workspace(folder/'oracle.sqlite3').dispose()
print(json.dumps(str(folder)))
"""
CLEANUP = """
import shutil,sys
from pathlib import Path
parent=(Path(sys.argv[1])/'.cache').resolve()
folder=Path(sys.argv[2]).resolve()
if folder.parent != parent or not folder.name.startswith('oracle-wsl-bridge-'):
    raise RuntimeError('Unexpected synthetic workspace')
shutil.rmtree(folder)
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--distribution", default="Ubuntu")
    parser.add_argument("--project", required=True, help="Absolute Linux checkout path")
    args = parser.parse_args()
    project = PurePosixPath(args.project)
    if os.name != "nt" or not project.is_absolute() or ".." in project.parts:
        parser.error("Run on Windows with an absolute Linux project path")
    command = [
        "wsl.exe",
        "--distribution",
        args.distribution,
        "--exec",
        str(project / ".venv/bin/python"),
        "-I",
    ]

    def run(arguments: list[str], payload: dict | None = None) -> bytes:
        result = subprocess.run(  # noqa: S603 -- explicit developer CLI, argv only, no shell
            [*command, *arguments],
            input=json.dumps(payload).encode() if payload else b"",
            capture_output=True,
            timeout=30,
            check=True,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        if len(result.stdout) > 2 * 1024 * 1024 or result.stderr:
            raise RuntimeError("Unexpected worker output")
        return result.stdout

    folder = None
    try:
        folder = json.loads(run(["-c", SETUP, str(project)]))
        synthetic = PurePosixPath(folder)
        if synthetic.parent != project / ".cache" or not synthetic.name.startswith(
            "oracle-wsl-bridge-"
        ):
            raise RuntimeError("Unexpected synthetic workspace")

        def request(payload: dict, *, missing: bool = False) -> dict:
            database = synthetic / ("missing.sqlite3" if missing else "oracle.sqlite3")
            return json.loads(run(["-m", "app.desktop_bridge", str(database)], payload))

        def require(condition: bool) -> None:
            if not condition:
                raise RuntimeError("Bridge contract check failed")

        require(request({"action": "profile_get"})["result"]["version"] == 0)
        identity = str(uuid4())
        created = request(
            {
                "action": "create",
                "id": identity,
                "version": 0,
                "data": {"company": "Synthetic WSL bridge check"},
            }
        )
        require(created["ok"] and created["protocol_version"] == 1)
        loaded = request({"action": "get", "id": identity})
        require(loaded == created)
        require(request({"action": "documents_list"})["result"] == {"items": []})
        require(request({"action": "profile_review_get"})["result"]["decisions"] == [])
        failure = request({"action": "profile_get", "unexpected": "synthetic"})
        require(failure == {"protocol_version": 1, "ok": False, "error": "invalid"})
        require(request({"action": "profile_get"}, missing=True)["error"] == "workspace_missing")
        print(
            json.dumps(
                {
                    "ok": True,
                    "checks": 7,
                    "transport": "wsl-exec-json-pipes",
                    "data": "synthetic-only",
                }
            )
        )
    finally:
        if folder is not None:
            run(["-c", CLEANUP, str(project), folder])


if __name__ == "__main__":
    main()
