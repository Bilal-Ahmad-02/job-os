"""Run opt-in Windows native tests against a disposable Ubuntu workspace only."""

import argparse
import json
import os
import shutil
import subprocess
import time
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
PROJECT = "/home/lethargic/projects/oracle"
SETUP = """
import json,os,tempfile
from pathlib import Path
from app.db.workspace import initialize_workspace
from app.db.store import read_identity
os.umask(0o077)
folder=Path(tempfile.mkdtemp(prefix='oracle-wsl-native-',dir=Path.home()/'projects/oracle/.cache'))
database=folder/'oracle.sqlite3'
initialize_workspace(database).dispose()
print(json.dumps({'database':str(database),'identity':read_identity(database)}))
"""
CLEANUP = """
import shutil,sys
from pathlib import Path
folder=Path(sys.argv[1]).resolve()
parent=Path.home()/'projects/oracle/.cache'
if folder.parent!=parent or not folder.name.startswith('oracle-wsl-native-'):
    raise RuntimeError('Unexpected synthetic fixture')
shutil.rmtree(folder)
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cold-start", action="store_true",
                        help="Wait for Ubuntu to stop naturally before the native tests")
    parser.add_argument("--runtime-project", help="Test a reviewed installed Linux release")
    args = parser.parse_args()
    if os.name != "nt":
        raise SystemExit("Run this native integration check on Windows")
    cargo = shutil.which("cargo")
    if cargo is None:
        raise SystemExit("The Windows Rust toolchain is unavailable")
    command = [str(Path(os.environ["SystemRoot"]) / "System32/wsl.exe"),
               "--distribution", "Ubuntu", "--user", "lethargic", "--exec",
               f"{PROJECT}/.venv/bin/python", "-I", "-c"]
    result = subprocess.run(  # noqa: S603 -- fixed native test setup, no shell
        [*command, SETUP], capture_output=True, timeout=40, check=True,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    fixture = json.loads(result.stdout)
    database = PurePosixPath(fixture["database"])
    if (database.parent.parent != PurePosixPath(PROJECT) / ".cache"
            or not database.parent.name.startswith("oracle-wsl-native-")
            or database.name != "oracle.sqlite3"):
        raise RuntimeError("Unexpected synthetic fixture")
    try:
        if args.cold_start:
            deadline = time.monotonic() + 30
            while True:
                state = subprocess.run(  # noqa: S603 -- fixed WSL inventory command
                    [command[0], "--list", "--running", "--quiet"], capture_output=True,
                    timeout=5, check=True, creationflags=subprocess.CREATE_NO_WINDOW,
                ).stdout.decode("utf-16-le").strip()
                if "Ubuntu" not in state.splitlines():
                    print("Confirmed Ubuntu is stopped before native invocation.", flush=True)
                    break
                if time.monotonic() >= deadline:
                    raise RuntimeError("Ubuntu remained running; no workloads were terminated")
                time.sleep(1)
        environment = os.environ.copy()
        environment["ORACLE_WSL_TEST_DATABASE"] = str(database)
        environment["ORACLE_WSL_TEST_IDENTITY"] = fixture["identity"]
        environment.pop("ORACLE_WSL_TEST_PROJECT", None)
        if args.runtime_project:
            candidate = PurePosixPath(args.runtime_project)
            releases = PurePosixPath('/home/lethargic/.local/share/oracle/runtime/releases')
            if (candidate.parent != releases
                    or len(candidate.name) != 64
                    or any(c not in '0123456789abcdef' for c in candidate.name)):
                raise ValueError("Expected a pinned installed runtime release")
            environment["ORACLE_WSL_TEST_PROJECT"] = str(candidate)
        subprocess.run(  # noqa: S603 -- developer's Windows Rust toolchain
            [cargo, "test", "--locked", "--manifest-path",
             str(ROOT / "apps/desktop/src-tauri/Cargo.toml"), "wsl_", "--",
             "--ignored", "--test-threads=1"], env=environment, cwd=ROOT, timeout=180, check=True,
        )
        print(json.dumps({"ok": True, "cold_start": args.cold_start, "data": "synthetic-only"}))
    finally:
        subprocess.run(  # noqa: S603 -- guarded synthetic fixture removal
            [*command, CLEANUP, str(database.parent)], capture_output=True,
            timeout=40, check=True, creationflags=subprocess.CREATE_NO_WINDOW,
        )


if __name__ == "__main__":
    main()
