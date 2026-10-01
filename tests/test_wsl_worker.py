"""Synthetic Linux supervision tests. Never touch the live Windows workspace."""

import json
import os
import selectors
import signal
import stat
import subprocess
import sys
import threading
import time
from pathlib import Path

import pytest

from app.db.store import read_identity
from app.db.workspace import initialize_workspace
from app.wsl_worker import WorkerFailure, private_workspace, read_frame, supervise

pytestmark = pytest.mark.skipif(sys.platform != "linux", reason="Linux process supervision")
OK = b'{"protocol_version":1,"ok":true,"result":{}}'


@pytest.fixture
def channel():
    read, write = os.pipe()
    os.set_blocking(read, False)
    with selectors.DefaultSelector() as selector:
        selector.register(read, selectors.EVENT_READ, "parent")
        yield read, write, selector
    os.close(read)
    os.close(write)


def run(code, channel, timeout=2, payload=b""):
    read, _, selector = channel
    return supervise([sys.executable, "-I", "-c", code], payload, read,
                     selector, time.monotonic() + timeout)


def test_real_supervised_worker_and_identity(tmp_path):
    database = tmp_path / "oracle.sqlite3"
    initialize_workspace(database).dispose()
    database.chmod(0o600)
    identity = read_identity(database)
    private_workspace(database, identity)
    command = [sys.executable, "-I", "-m", "app.wsl_worker", "request", str(database), identity]
    with subprocess.Popen(command,  # noqa: S603 -- fixed synthetic worker
                          stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE) as child:
        raw = b'{"action":"list"}'
        child.stdin.write(len(raw).to_bytes(4, "big") + raw)
        child.stdin.flush()  # Keep cancellation pipe open until the response.
        result = json.loads(child.stdout.read())
        assert result == {"protocol_version": 1, "ok": True, "result": {"items": [], "total": 0}}
        assert child.wait(timeout=3) == 0
        assert child.stderr.read() == b""
    with pytest.raises(WorkerFailure):
        private_workspace(database, "00000000-0000-0000-0000-000000000000")
    database.chmod(0o644)
    with pytest.raises(WorkerFailure):
        private_workspace(database, identity)
    database.chmod(0o600)
    alias = tmp_path / "alias.sqlite3"
    alias.symlink_to(database)
    with pytest.raises(WorkerFailure):
        private_workspace(alias, identity)


def test_request_is_written_while_response_is_read(channel):
    code = ("import sys; data=sys.stdin.buffer.read(); assert len(data)==200000; print("
            + repr(OK.decode()) + ")")
    assert run(code, channel, payload=b"x" * 200000).strip() == OK


@pytest.mark.parametrize("reply", ["not json", '{"protocol_version":1,"ok":true}',
                                   '{"protocol_version":1,"ok":true,"result":{},"extra":0}'])
def test_partial_or_invalid_response_fails_closed(channel, reply):
    with pytest.raises((WorkerFailure, ValueError)):
        run("print(" + repr(reply) + ")", channel)


def test_oversized_output_fails_without_unbounded_buffer(channel):
    with pytest.raises(WorkerFailure):
        run("import sys; sys.stdout.write('x'*3000000)", channel)


def test_timeout_kills_inherited_pipe_descendant(channel, tmp_path):
    pid_file = tmp_path / "pid"
    grandchild = "import time; time.sleep(60)"
    code = ("import subprocess,sys,time; from pathlib import Path; "
            f"p=subprocess.Popen([sys.executable,'-I','-c',{grandchild!r}]); "
            f"Path({str(pid_file)!r}).write_text(str(p.pid)); time.sleep(60)")
    started = time.monotonic()
    with pytest.raises(WorkerFailure):
        run(code, channel, timeout=0.5)
    assert time.monotonic() - started < 3
    pid = int(pid_file.read_text())
    for _ in range(100):
        path = Path(f"/proc/{pid}/stat")
        if not path.exists() or path.read_text().split()[2] == "Z":
            break
        time.sleep(0.01)
    else:
        os.kill(pid, signal.SIGKILL)
        pytest.fail("Descendant survived cancellation")


def test_parent_cancellation_rolls_back_transaction(channel, tmp_path):
    import sqlite3
    database = tmp_path / "synthetic.sqlite3"
    with sqlite3.connect(database) as connection:
        connection.execute("CREATE TABLE records (value TEXT)")
    ready = tmp_path / "ready"
    code = ("import sqlite3,time; from pathlib import Path; "  # noqa: S608 -- fixed test SQL
            f"c=sqlite3.connect({str(database)!r}); c.execute('BEGIN IMMEDIATE'); "
            "c.execute(\"INSERT INTO records VALUES ('uncommitted')\"); "
            f"Path({str(ready)!r}).touch(); time.sleep(60)")

    def cancel():
        for _ in range(100):
            if ready.exists():
                os.write(channel[1], b"cancel")
                return
            time.sleep(0.01)

    thread = threading.Thread(target=cancel)
    thread.start()
    try:
        with pytest.raises(WorkerFailure):
            run(code, channel)
    finally:
        thread.join(timeout=2)
    assert ready.exists()
    with sqlite3.connect(database, timeout=0.1) as connection:
        assert connection.execute("SELECT * FROM records").fetchall() == []
        connection.execute("INSERT INTO records VALUES ('retry')")


def test_eof_cancels_worker(tmp_path):
    read, write = os.pipe()
    with selectors.DefaultSelector() as selector:
        selector.register(read, selectors.EVENT_READ, "parent")
        os.close(write)
        with pytest.raises(WorkerFailure):
            supervise([sys.executable, "-I", "-c", "import time; time.sleep(60)"],
                      b"", read, selector, time.monotonic() + 1)
    os.close(read)


@pytest.mark.parametrize("frame", [b"\x00\x10\x00\x00", b"\x00\x00\x00\x01xy"])
def test_invalid_frame(channel, frame):
    read, write, selector = channel
    os.write(write, frame)
    with pytest.raises(WorkerFailure):
        read_frame(read, selector, time.monotonic() + 0.2)


def test_partial_input_has_deadline(channel):
    read, write, selector = channel
    os.write(write, b"\x00\x00")
    with pytest.raises(WorkerFailure):
        read_frame(read, selector, time.monotonic() + 0.1)


def test_new_worker_files_are_private(channel, tmp_path):
    path = tmp_path / "worker-created"
    code = f"from pathlib import Path; Path({str(path)!r}).touch(); print({OK.decode()!r})"
    run(code, channel)
    assert stat.S_IMODE(path.stat().st_mode) == 0o600


def test_guardian_rejects_a_dead_parent_before_application_work(tmp_path):
    marker = tmp_path / "must-not-run"
    code = ("import sys; from app.wsl_guard import watch; "
            f"watch([sys.executable,'-c',\"open({str(marker)!r},'w').close()\"],1)")
    result = subprocess.run(  # noqa: S603 -- synthetic child in its own process group
        [sys.executable, "-I", "-c", code], start_new_session=True,
        capture_output=True, timeout=3,
    )
    assert result.returncode == -signal.SIGKILL
    assert not marker.exists()


def test_guardian_reaps_group_after_success(channel, tmp_path):
    marker = tmp_path / "descendant"
    child_code = ("import subprocess,sys; from pathlib import Path; "
                  "p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)']); "
                  f"Path({str(marker)!r}).write_text(str(p.pid)); print({OK.decode()!r})")
    code = ("import sys; from app.wsl_guard import watch; "
            f"watch([sys.executable,'-I','-c',{child_code!r}],{os.getpid()})")
    assert run(code, channel).strip() == OK
    path = Path(f"/proc/{int(marker.read_text())}/stat")
    for _ in range(100):
        if not path.exists() or path.read_text().split()[2] == "Z":
            break
        time.sleep(0.01)
    else:
        pytest.fail("Descendant survived normal guardian completion")


def test_killed_worker_cannot_forge_success_without_exit_marker(channel):
    code = ("import os,signal,sys; "
            f"print({OK.decode()!r},flush=True); os.kill(os.getpid(),signal.SIGKILL)")
    with pytest.raises(WorkerFailure):
        run(code, channel)
