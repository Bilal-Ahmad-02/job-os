"""Explicit local maintenance; PDF text and draft claims never travel over a network."""

import argparse
import json
from pathlib import Path

from pydantic import ValidationError

from app.db.store import open_store
from app.db.workspace import prepare_workspace
from app.schemas.evidence import DraftPayload
from app.services.documents import list_documents
from app.services.evidence import EvidenceError, extract_document, store_draft
from app.services.pdf_reader import DocumentError


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract local pages or import an unreviewed draft."
    )
    parser.add_argument("operation", choices=("extract", "import"))
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument(
        "--input", type=Path, help="Private local draft JSON, outside source control"
    )
    args = parser.parse_args()
    engine = None
    try:
        payload = None
        if args.operation == "import":
            if args.input is None:
                raise EvidenceError("draft_input_required")
            with args.input.open("rb") as stream:
                raw = stream.read(512 * 1024 + 1)
            if len(raw) > 512 * 1024:
                raise EvidenceError("draft_invalid")
            payload = DraftPayload.model_validate_json(raw)
        elif args.input is not None:
            raise EvidenceError("draft_invalid")
        prepare_workspace(args.database)
        engine = open_store(args.database)
        if payload is not None:
            store_draft(engine, payload)
            result = {"ok": True, "status": "unreviewed", "entries": len(payload.evidence)}
        else:
            documents = list_documents(engine).items
            if not documents:
                raise EvidenceError("source_missing")
            pages = sum(extract_document(engine, str(item.id)) for item in documents)
            result = {"ok": True, "documents": len(documents), "pages": pages}
        print(json.dumps(result))
    except (DocumentError, EvidenceError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}))
        raise SystemExit(1) from None
    except ValidationError:
        print(json.dumps({"ok": False, "error": "draft_invalid"}))
        raise SystemExit(1) from None
    except Exception:
        print(json.dumps({"ok": False, "error": "draft_operation_failed"}))
        raise SystemExit(1) from None
    finally:
        if engine is not None:
            engine.dispose()


if __name__ == "__main__":
    main()
