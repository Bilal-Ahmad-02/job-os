"""One bounded JSON request on inherited pipes. No listening network socket.

Owns parsing, error redaction, response encoding and the per-request engine lifetime.
Typed routing and business rules live in operations and feature services respectively.
"""

import json
import sys
from pathlib import Path

from pydantic import TypeAdapter, ValidationError

from app.db.store import WorkspaceError, open_store
from app.operations import execute_operation
from app.schemas.desktop import DesktopRequest, Failure, Success
from app.services.applications import RecordError
from app.services.profile import ProfileConflict

MAX_REQUEST = 512 * 1024
# Reserve space inside the native/WSL 2 MiB ceiling for the guardian exit footer.
MAX_RESPONSE = 2 * 1024 * 1024 - 256
REQUEST_ADAPTER = TypeAdapter(DesktopRequest)


def unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("Duplicate JSON member")
        value[key] = item
    return value


def reject_constant(_value: str) -> None:
    raise ValueError("Non-finite JSON number")


def parse_request(raw: bytes) -> DesktopRequest:
    if len(raw) > MAX_REQUEST:
        raise ValueError("Request too large")
    # Reject ambiguity at any depth before Pydantic can silently keep the last key.
    # Retain validate_json semantics (e.g. UUID parsing) for the existing wire contract.
    json.loads(raw, object_pairs_hook=unique_object, parse_constant=reject_constant)
    return REQUEST_ADAPTER.validate_json(raw)


def failure_for(error: Exception) -> Failure:
    if isinstance(error, (ValueError, ValidationError, RecursionError)):
        return Failure(error="invalid")
    if isinstance(error, ProfileConflict):
        return Failure(error="conflict")
    if isinstance(error, (RecordError, WorkspaceError)):
        try:
            return Failure(error=str(error))
        except ValidationError:
            pass
    # No exception text, paths, request bodies, or record contents cross the pipe.
    return Failure(error="storage")


def handle_request(database: Path, raw: bytes) -> Success | Failure:
    engine = None
    try:
        request = parse_request(raw)
        engine = open_store(database)
        result = Success(result=execute_operation(engine, request))
    except Exception as error:
        result = failure_for(error)
    finally:
        if engine is not None:
            try:
                engine.dispose()
            except Exception:
                result = Failure(error="storage")
    return result


def encode_response(result: Success | Failure) -> bytes:
    try:
        encoded = result.model_dump_json().encode("utf-8")
        if len(encoded) <= MAX_RESPONSE:
            return encoded
    except Exception:
        return Failure(error="storage").model_dump_json().encode("utf-8")
    # Never send partial/truncated JSON or dump a private serialization error.
    return Failure(error="storage").model_dump_json().encode("utf-8")


def main() -> None:
    if len(sys.argv) != 2:
        result = Failure(error="invalid")
    else:
        result = handle_request(Path(sys.argv[1]), sys.stdin.buffer.read(MAX_REQUEST + 1))
    sys.stdout.buffer.write(encode_response(result))


if __name__ == "__main__":
    main()
