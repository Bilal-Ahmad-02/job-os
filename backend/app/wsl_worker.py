"""Linux-only supervisor for one native desktop request over inherited pipes.

stdin is a four-byte big-endian length, the request, then an open cancellation
pipe. EOF cancels the worker. Only fixed application modules can be launched.
"""

import argparse
import json
import os
import selectors
import signal
import stat
import subprocess
import sys
import time
from pathlib import Path
from uuid import UUID

from app.wsl_guard import EXIT_MARKERS

MAX_REQUEST = 512 * 1024
MAX_RESPONSE = 2 * 1024 * 1024
DEADLINE_SECONDS = 15
FAILURE = b'{"protocol_version":1,"ok":false,"error":"runtime_unavailable"}'


class WorkerFailure(Exception):
    """A transport failure whose details must not reach the renderer."""


def private_workspace(database: Path, identity: str) -> None:
    # No mounted Windows paths, symlink traversal, or shared/readable workspace.
    if not database.is_absolute() or database.resolve() != database:
        raise WorkerFailure
    if database.parts[1] in {"mnt", "media", "run", "proc", "sys", "dev"}:
        raise WorkerFailure
    for path, directory in ((database.parent, True), (database, False),
                            (database.with_suffix(".workspace-id"), False)):
        info = path.stat(follow_symlinks=False)
        correct_type = stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)
        if not correct_type or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise WorkerFailure
    if str(UUID(identity)) != identity:
        raise WorkerFailure
    with database.with_suffix(".workspace-id").open("rb") as stream:
        if stream.read(38) != (identity + "\n").encode("ascii"):
            raise WorkerFailure


def read_frame(channel: int, selector: selectors.BaseSelector, deadline: float) -> bytes:
    frame = bytearray()
    size = None
    while time.monotonic() < deadline:
        if not selector.select(min(0.1, max(0, deadline - time.monotonic()))):
            continue
        chunk = os.read(channel, 65536)
        if not chunk:
            raise WorkerFailure
        frame.extend(chunk)
        if len(frame) >= 4 and size is None:
            size = int.from_bytes(frame[:4], "big")
            if size > MAX_REQUEST:
                raise WorkerFailure
        if size is not None and len(frame) >= size + 4:
            if len(frame) != size + 4:
                raise WorkerFailure
            return bytes(frame[4:])
    raise WorkerFailure


def supervise(command: list[str], payload: bytes, channel: int,
              selector: selectors.BaseSelector, deadline: float) -> bytes:
    # All trusted descendants inherit this process group. They must not detach.
    # No response escapes until the group is terminated and the worker reaped.
    if selector.select(0):
        raise WorkerFailure
    child = subprocess.Popen(  # noqa: S603 -- fixed module argv supplied by main
        command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL, start_new_session=True, umask=0o077,
    )
    try:
        if child.stdin is None or child.stdout is None:
            raise WorkerFailure
        os.set_blocking(child.stdin.fileno(), False)
        os.set_blocking(child.stdout.fileno(), False)
        selector.register(child.stdout, selectors.EVENT_READ, "output")
        if payload:
            selector.register(child.stdin, selectors.EVENT_WRITE, "input")
        else:
            child.stdin.close()
        remaining = memoryview(payload)
        result = bytearray()
        ended = False
        while time.monotonic() < deadline:
            for key, _ in selector.select(0.05):
                if key.data == "parent":
                    # Both EOF and unexpected extra bytes invalidate the lease.
                    os.read(channel, 1)
                    raise WorkerFailure
                if key.data == "input":
                    count = os.write(key.fd, remaining[:65536])
                    remaining = remaining[count:]
                    if not remaining:
                        selector.unregister(child.stdin)
                        child.stdin.close()
                else:
                    chunk = os.read(key.fd, 65536)
                    result.extend(chunk)
                    if len(result) > MAX_RESPONSE:
                        raise WorkerFailure
                    if not chunk:
                        ended = True
                        selector.unregister(child.stdout)
            if ended and child.poll() is not None:
                # Maintenance uses exit 1 for structured errors. A killed worker
                # or arbitrary exit cannot masquerade as a complete reply.
                if child.returncode == -signal.SIGKILL:
                    marker = next((m for m in EXIT_MARKERS if result.endswith(m)), None)
                    if marker is None:
                        raise WorkerFailure
                    del result[-len(marker):]
                elif child.returncode not in (0, 1):
                    raise WorkerFailure
                value = json.loads(result)
                if not isinstance(value, dict) or value.get("protocol_version") != 1:
                    raise WorkerFailure
                if type(value.get("ok")) is not bool:
                    raise WorkerFailure
                expected = {"protocol_version", "ok", "result" if value["ok"] else "error"}
                if set(value) != expected:
                    raise WorkerFailure
                return bytes(result)
        raise WorkerFailure
    finally:
        # Kill descendants even when their direct parent already exited, or when
        # they retained a pipe that would otherwise hide EOF forever.
        try:
            os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        child.wait(timeout=2)
        for stream in (child.stdin, child.stdout):
            if stream is not None:
                stream.close()


def main() -> None:
    result = FAILURE
    try:
        if sys.platform != "linux":
            raise WorkerFailure
        os.umask(0o077)
        parser = argparse.ArgumentParser(add_help=False)
        parser.add_argument("operation", choices=("request", "prepare"))
        parser.add_argument("database", type=Path)
        parser.add_argument("identity")
        args = parser.parse_args()
        deadline = time.monotonic() + DEADLINE_SECONDS
        with selectors.DefaultSelector() as selector:
            channel = sys.stdin.fileno()
            os.set_blocking(channel, False)
            selector.register(channel, selectors.EVENT_READ, "parent")
            payload = read_frame(channel, selector, deadline)
            private_workspace(args.database, args.identity)
            if args.operation == "prepare" and payload:
                raise WorkerFailure
            command = [sys.executable, "-I", "-m", "app.wsl_guard", str(os.getpid()),
                       args.operation, str(args.database)]
            result = supervise(command, payload, channel, selector, deadline)
    except (Exception, SystemExit):
        # Never print private paths, payloads, SQL, or parser diagnostics.
        result = FAILURE
    try:
        sys.stdout.buffer.write(result)
        sys.stdout.buffer.flush()
    except BrokenPipeError:
        pass


if __name__ == "__main__":
    main()
