"""Fixed, bounded child process for untrusted PDF bytes."""

import json
import os
import subprocess
import sys
from pathlib import Path

from app.pdf_probe import MAX_PDF, MAX_TEXT_BYTES


class DocumentError(Exception):
    """Stable public code, no private file contents or paths."""


def probe_pdf(raw: bytes, *, extract: bool = False, timeout: float = 15) -> dict:
    if not raw.startswith(b"%PDF-") or len(raw) > MAX_PDF:
        raise DocumentError("document_invalid")
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    with subprocess.Popen(  # noqa: S603 -- fixed module/interpreter; PDF bytes only on stdin
        [sys.executable, "-I", "-m", "app.pdf_probe", *(["--text"] if extract else [])],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        creationflags=flags,
    ) as process:
        try:
            output, _ = process.communicate(raw, timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            if os.name == "nt":
                try:
                    subprocess.run(  # noqa: S603 -- fixed Windows utility, numeric process ID
                        [
                            str(Path(os.environ["SystemRoot"]) / "System32" / "taskkill.exe"),
                            "/PID",
                            str(process.pid),
                            "/T",
                            "/F",
                        ],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=flags,
                        timeout=5,
                        check=False,
                    )
                except (OSError, subprocess.TimeoutExpired):
                    pass
                process.kill()
            else:
                process.kill()
            process.communicate(timeout=5)
            raise DocumentError("document_timeout") from exc
    if process.returncode != 0 or len(output) > (MAX_TEXT_BYTES + 4096 if extract else 1024):
        raise DocumentError("document_invalid")
    try:
        result = json.loads(output)
    except (ValueError, UnicodeError) as exc:
        raise DocumentError("document_invalid") from exc
    if not isinstance(result, dict):
        raise DocumentError("document_invalid")
    count = result.get("pages")
    if type(count) is not int or not 1 <= count <= 100:
        raise DocumentError("document_invalid")
    if extract:
        pages = result.get("text")
        if (
            not isinstance(pages, list)
            or len(pages) != count
            or any(not isinstance(page, str) or len(page) > 64000 for page in pages)
            or sum(len(page.encode("utf-8")) for page in pages) > MAX_TEXT_BYTES
        ):
            raise DocumentError("document_invalid")
    return result
