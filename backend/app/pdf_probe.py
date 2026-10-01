"""Disposable bounded PDF inspection/extraction. Never follows links or executes actions."""

import io
import json
import logging
import sys

MAX_PDF = 10 * 1024 * 1024
MAX_TEXT_BYTES = 512 * 1024


def main() -> None:
    logging.disable(logging.CRITICAL)
    try:
        from app.pdf_limits import limit_worker_memory

        limit_worker_memory()
        from pypdf import PdfReader

        if sys.argv[1:] not in ([], ["--text"]):
            raise ValueError("Invalid operation")
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
        if sys.argv[1:] == ["--text"]:
            texts = []
            total = 0
            for page in reader.pages:
                text = page.extract_text() or ""
                total += len(text.encode("utf-8"))
                if len(text) > 64000 or total > MAX_TEXT_BYTES:
                    raise ValueError("Text limit")
                texts.append(text)
            result["text"] = texts
        output = json.dumps(result, ensure_ascii=False).encode("utf-8")
        if len(output) > MAX_TEXT_BYTES + 4096:
            raise ValueError("Output limit")
    except Exception:
        output = b'{"error":"document_invalid"}'
    sys.stdout.buffer.write(output)


if __name__ == "__main__":
    main()
