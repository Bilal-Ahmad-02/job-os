"""Isolated, metadata-only PDF inspection. No text extraction, links, or actions."""

import io
import json
import logging
import sys

MAX_PDF = 10 * 1024 * 1024


def main() -> None:
    from pypdf import PdfReader

    logging.disable(logging.CRITICAL)
    try:
        raw = sys.stdin.buffer.read(MAX_PDF + 1)
        if len(raw) > MAX_PDF or not raw.startswith(b"%PDF-"):
            raise ValueError("Invalid PDF")
        reader = PdfReader(io.BytesIO(raw), strict=True)
        if reader.is_encrypted and not reader.decrypt(""):
            raise ValueError("Encrypted PDF")
        count = len(reader.pages)
        if not 1 <= count <= 100:
            raise ValueError("Page limit")
        result = {"pages": count}
    except Exception:
        result = {"error": "document_invalid"}
    print(json.dumps(result))


if __name__ == "__main__":
    main()
