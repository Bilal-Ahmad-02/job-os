"""Linux process-group guardian. Runs no application work before arming cleanup."""

import ctypes
import os
import signal
import subprocess
import sys

EXIT_MARKERS = (b"\nORACLE_EXIT=0\n", b"\nORACLE_EXIT=1\n")


def watch(command: list[str], parent: int) -> None:
    if sys.platform != "linux" or os.getpgrp() != os.getpid():
        raise RuntimeError("Guardian requires a dedicated Linux process group")

    def cancel(_signum=None, _frame=None):
        os.killpg(os.getpid(), signal.SIGKILL)

    # This process stays in Python's bounded wait loop, so signals are handled
    # independently of SQLite or parser C code running in the application child.
    signal.signal(signal.SIGTERM, cancel)
    signal.signal(signal.SIGHUP, cancel)
    signal.signal(signal.SIGALRM, cancel)
    libc = ctypes.CDLL(None, use_errno=True)
    prctl = libc.prctl
    prctl.argtypes = [ctypes.c_int, ctypes.c_ulong, ctypes.c_ulong,
                     ctypes.c_ulong, ctypes.c_ulong]
    prctl.restype = ctypes.c_int
    if prctl(1, signal.SIGTERM, 0, 0, 0) != 0:  # PR_SET_PDEATHSIG
        cancel()
    # Close the race where the supervisor died before prctl was installed.
    if os.getppid() != parent:
        cancel()
    signal.alarm(15)
    try:
        child = subprocess.Popen(command)  # noqa: S603 -- fixed application module argv
        status = child.wait(timeout=15)
        if status in (0, 1):
            # A complete response alone is insufficient: certify child exit
            # before killing this entire group, including the guardian itself.
            os.write(sys.stdout.fileno(), EXIT_MARKERS[status])
    finally:
        cancel()


def main() -> None:
    if len(sys.argv) != 4 or sys.argv[2] not in ("request", "prepare"):
        raise SystemExit(2)
    parent = int(sys.argv[1])
    module = (["app.desktop_bridge"] if sys.argv[2] == "request"
              else ["app.workspace", "prepare"])
    watch([sys.executable, "-I", "-m", *module, sys.argv[3]], parent)


if __name__ == "__main__":
    main()
