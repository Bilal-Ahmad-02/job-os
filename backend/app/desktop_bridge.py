"""One bounded JSON request on inherited pipes. No listening network socket."""

import sys
from pathlib import Path

from pydantic import TypeAdapter, ValidationError

from app.db.store import WorkspaceError, open_store
from app.schemas.applications import GetRequest, ListRequest
from app.schemas.desktop import DesktopRequest, Failure, Success
from app.schemas.documents import DocumentListRequest
from app.services.applications import (
    RecordError,
    get_application,
    list_applications,
    save_application,
)
from app.services.documents import list_documents

MAX_REQUEST = 512 * 1024


def main() -> None:
    engine = None
    try:
        if len(sys.argv) != 2:
            raise ValueError("Expected database path")
        raw = sys.stdin.buffer.read(MAX_REQUEST + 1)
        if len(raw) > MAX_REQUEST:
            raise ValueError("Request too large")
        request = TypeAdapter(DesktopRequest).validate_json(raw)
    except (ValueError, ValidationError):
        result = Failure(error="invalid")
    else:
        try:
            engine = open_store(Path(sys.argv[1]))
            if isinstance(request, ListRequest):
                payload = list_applications(engine, request)
            elif isinstance(request, GetRequest):
                payload = get_application(engine, request)
            elif isinstance(request, DocumentListRequest):
                payload = list_documents(engine)
            else:
                payload = save_application(engine, request)
            result = Success(result=payload)
        except (RecordError, WorkspaceError) as exc:
            try:
                result = Failure(error=str(exc))
            except ValidationError:
                result = Failure(error="storage")
        except Exception:
            result = Failure(error="storage")
        finally:
            if engine is not None:
                engine.dispose()
    sys.stdout.buffer.write(result.model_dump_json().encode("utf-8"))


if __name__ == "__main__":
    main()
