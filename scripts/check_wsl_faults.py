"""Test host disconnect/crash against the Linux supervisor with synthetic data only."""

import json
import os
import subprocess
import time
from pathlib import Path, PurePosixPath

from check_wsl_native import CLEANUP, PROJECT, SETUP

# Test-only child holds an uncommitted SQLite transaction and starts a descendant.
# No arbitrary-command option is added to the production supervisor CLI.
WORKER = """
import json,subprocess,sys,time,sqlite3
from pathlib import Path
folder=Path(sys.argv[1])
c=sqlite3.connect(folder/'fault.sqlite3')
c.execute('CREATE TABLE IF NOT EXISTS records(value TEXT)')
c.commit()
c.execute('BEGIN IMMEDIATE')
c.execute("INSERT INTO records VALUES ('uncommitted synthetic record')")
p=subprocess.Popen([sys.executable,'-I','-c','import time; time.sleep(60)'])
pids=[__import__('os').getpid(),p.pid,__import__('os').getppid()]
tokens={str(pid):Path(f'/proc/{pid}/stat').read_text().split()[21] for pid in pids}
(folder/'ready.json').write_text(json.dumps(tokens))
time.sleep(60)
"""
SUPERVISOR = """
import os,selectors,sys,time
from app.wsl_worker import read_frame,supervise,FAILURE
with selectors.DefaultSelector() as selector:
    channel=sys.stdin.fileno()
    os.set_blocking(channel,False)
    selector.register(channel,selectors.EVENT_READ,'parent')
    deadline=time.monotonic()+15
    try:
        raw=read_frame(channel,selector,deadline)
        guardian=('import sys; from app.wsl_guard import watch; '
                  'watch([sys.executable,"-I","-c",sys.argv[1],sys.argv[2]],int(sys.argv[3]))')
        result=supervise([sys.executable,'-I','-c',guardian,sys.argv[2],sys.argv[1],str(os.getpid())],raw,
                         channel,selector,deadline)
    except Exception:
        result=FAILURE
sys.stdout.buffer.write(result)
"""
INSPECT = """
import json,sys,sqlite3
from pathlib import Path
folder=Path(sys.argv[1])
ready=folder/'ready.json'
running=False
if ready.exists():
    for pid,started in json.loads(ready.read_text()).items():
        path=Path('/proc')/pid/'stat'
        if path.exists():
            fields=path.read_text().split()
            running |= fields[21]==started and fields[2]!='Z'
result={'ready':ready.exists(),'running':running}
if ready.exists() and not running:
    c=sqlite3.connect(folder/'fault.sqlite3',timeout=0.2)
    result['rolled_back']=c.execute('SELECT count(*) FROM records').fetchone()[0]==0
    c.execute("INSERT INTO records VALUES ('recovery succeeds')")
    c.rollback()
    c.close()
    result['lock_released']=True
print(json.dumps(result))
"""


def main() -> None:
    if os.name != "nt":
        raise SystemExit("Run this fault probe on Windows")
    command = [str(Path(os.environ["SystemRoot"]) / "System32/wsl.exe"),
               "--distribution", "Ubuntu", "--user", "lethargic", "--exec",
               f"{PROJECT}/.venv/bin/python", "-I", "-c"]

    def run(code: str, *args: str) -> dict:
        result = subprocess.run(  # noqa: S603 -- fixed synthetic test code, argv only
            [*command, code, *args], capture_output=True, timeout=30, check=True,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        return json.loads(result.stdout) if result.stdout else {}

    for mode in ("pipe_disconnect", "host_process_killed"):
        fixture = run(SETUP)
        folder = PurePosixPath(fixture["database"]).parent
        if (folder.parent != PurePosixPath(PROJECT) / ".cache"
                or not folder.name.startswith("oracle-wsl-native-")):
            raise RuntimeError("Unexpected synthetic fixture")
        child = None
        try:
            child = subprocess.Popen(  # noqa: S603 -- fixed synthetic supervisor harness
                [*command, SUPERVISOR, str(folder), WORKER], stdin=subprocess.PIPE,
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
            child.stdin.write(b"\0\0\0\0")
            child.stdin.flush()
            deadline = time.monotonic() + 10
            while not run(INSPECT, str(folder))["ready"]:
                if time.monotonic() >= deadline:
                    raise RuntimeError("Synthetic transaction did not start")
                time.sleep(0.1)
            started = time.monotonic()
            if mode == "pipe_disconnect":
                child.stdin.close()
            else:
                child.kill()  # Only this test's wsl.exe launcher, never the distribution.
            deadline = time.monotonic() + 18
            while True:
                state = run(INSPECT, str(folder))
                if not state["running"]:
                    if not state.get("rolled_back") or not state.get("lock_released"):
                        raise RuntimeError("Synthetic recovery check failed")
                    break
                if time.monotonic() >= deadline:
                    raise RuntimeError("A Linux descendant survived its deadline")
                time.sleep(0.1)
            child.wait(timeout=3)
            print(json.dumps({"ok": True, "scenario": mode,
                              "recovery_seconds": round(time.monotonic() - started, 2)}))
        finally:
            if child is not None:
                if child.poll() is None:
                    child.kill()
                child.wait(timeout=3)
                for stream in (child.stdin, child.stdout):
                    if stream is not None:
                        stream.close()
            state = run(INSPECT, str(folder))
            if state["running"]:
                print("Fault fixture retained because a test process is still running.")
            else:
                run(CLEANUP, str(folder))


if __name__ == "__main__":
    main()
