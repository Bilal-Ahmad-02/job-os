"""Explicit local maintenance import. Never accepts file paths from the renderer."""

import argparse
import json
from pathlib import Path

from app.db.store import open_store
from app.db.workspace import prepare_workspace
from app.services.documents import DocumentError, import_documents, read_document


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import original PDFs into the private Oracle database."
    )
    parser.add_argument("--database", type=Path, required=True)
    for kind in ("cv", "certificate", "transcript"):
        parser.add_argument(f"--{kind}", type=Path)
    args = parser.parse_args()
    engine = None
    try:
        documents = [
            read_document(kind, path)
            for kind in ("cv", "certificate", "transcript")
            if (path := getattr(args, kind)) is not None
        ]
        if not documents:
            raise DocumentError("document_batch_limit")
        prepare_workspace(args.database)
        engine = open_store(args.database)
        identities = import_documents(engine, documents)
        print(json.dumps({"ok": True, "documents": len(identities)}))
    except DocumentError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        raise SystemExit(1) from None
    except Exception:
        print(json.dumps({"ok": False, "error": "document_import_failed"}))
        raise SystemExit(1) from None
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    main()
