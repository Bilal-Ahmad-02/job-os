"""Synthetic routing, IPC and resource-lifetime regressions. No private workspace."""

import json
import subprocess
import sys
from typing import get_args
from unittest.mock import Mock

import pytest

from app import desktop_bridge as bridge
from app import operations
from app.db.store import WorkspaceError
from app.db.workspace import initialize_workspace
from app.schemas.applications import ApplicationPage
from app.schemas.desktop import DesktopRequest, Failure, Success
from app.services.applications import RecordError, execute
from app.services.profile import ProfileConflict

IDENTITY = "12345678-1234-1234-1234-123456789012"
ROUTES = [
    ({"action": "tasks_list"}, "list_tasks", False),
    ({"action": "task_create", "id": IDENTITY, "document_ids": [IDENTITY]}, "create_task", True),
    ({"action": "task_advance", "id": IDENTITY, "version": 1}, "change_task", True),
    ({"action": "task_cancel", "id": IDENTITY, "version": 1}, "change_task", True),
    ({"action": "task_retry", "id": IDENTITY, "version": 1}, "change_task", True),
    ({"action": "list"}, "list_applications", True),
    ({"action": "get", "id": IDENTITY}, "get_application", True),
    (
        {"action": "create", "id": IDENTITY, "version": 0, "data": {"title": "Synthetic role"}},
        "save_application",
        True,
    ),
    (
        {"action": "update", "id": IDENTITY, "version": 1, "data": {"title": "Synthetic role"}},
        "save_application",
        True,
    ),
    ({"action": "documents_list"}, "list_documents", False),
    ({"action": "profile_get"}, "get_profile", False),
    ({"action": "profile_save", "version": 0, "data": {}}, "save_profile", True),
    ({"action": "profile_draft_get"}, "get_draft", False),
    ({"action": "profile_review_get"}, "get_review", False),
    (
        {
            "action": "profile_review_save",
            "version": 0,
            "profile_version": 0,
            "draft_sha256": "a" * 64,
            "target": "full_name",
            "decision": "rejected",
        },
        "save_review",
        True,
    ),
]


@pytest.mark.parametrize("payload,handler,with_request", ROUTES)
def test_every_validated_operation_calls_only_its_explicit_service(
    monkeypatch, payload, handler, with_request
):
    engine = object()
    result = ApplicationPage(total=0, items=[])
    mocks = {name: Mock(return_value=result) for _, name, _ in ROUTES}
    for name, mock in mocks.items():
        monkeypatch.setattr(operations, name, mock)
    request = bridge.parse_request(json.dumps(payload).encode())
    assert operations.execute_operation(engine, request) is result
    for name, mock in mocks.items():
        if name == handler:
            mock.assert_called_once_with(*((engine, request) if with_request else (engine,)))
        else:
            mock.assert_not_called()


def test_route_cases_cover_the_entire_request_union():
    # A newly added schema requires a deliberate routing test, not a catch-all write.
    covered = {type(bridge.parse_request(json.dumps(p).encode())) for p, _, _ in ROUTES}
    assert covered == set(get_args(get_args(DesktopRequest)[0]))


def test_unknown_objects_never_fall_through_to_application_save(monkeypatch):
    from app.services import applications

    write = Mock()
    monkeypatch.setattr(operations, "save_application", write)
    monkeypatch.setattr(applications, "save_application", write)
    for dispatch in (operations.execute_operation, execute):
        with pytest.raises(ValueError, match="Unsupported"):
            dispatch(object(), {"action": "create"})
    write.assert_not_called()


@pytest.mark.parametrize(
    "raw",
    [
        b'{"action":"list","action":"profile_get"}',
        b'{"action":"profile_save","version":0,"data":{"full_name":"A","full_name":"B"}}',
        b'{"action":"list","offset":NaN}',
        b'{"action":"list","offset":Infinity}',
        b'{"action":"list","offset":-Infinity}',
        b'{"action":"delete_everything"}',
        b'{"action":"list","database":"/private/other.sqlite3"}',
        b'{"action":"list"} trailing',
        b"[]",
        b"null",
        b"\xff",
        b"[" * 2000 + b"]" * 2000,
        b" " * (bridge.MAX_REQUEST + 1),
    ],
)
def test_invalid_input_cannot_open_a_database(monkeypatch, tmp_path, raw):
    opener = Mock()
    monkeypatch.setattr(bridge, "open_store", opener)
    result = bridge.handle_request(tmp_path / "absent.sqlite3", raw)
    assert result == Failure(error="invalid")
    opener.assert_not_called()
    assert not list(tmp_path.iterdir())


@pytest.mark.parametrize(
    "error,code",
    [
        (ProfileConflict(), "conflict"),
        (RecordError("not_found"), "not_found"),
        (WorkspaceError("workspace_missing"), "workspace_missing"),
        (WorkspaceError("private path and data"), "storage"),
        (RuntimeError("private path and data"), "storage"),
        (ValueError("private path and data"), "invalid"),
    ],
)
def test_service_failures_are_redacted_and_engine_is_disposed(monkeypatch, tmp_path, error, code):
    engine = Mock()
    monkeypatch.setattr(bridge, "open_store", Mock(return_value=engine))
    monkeypatch.setattr(bridge, "execute_operation", Mock(side_effect=error))
    result = bridge.handle_request(tmp_path / "synthetic.sqlite3", b'{"action":"list"}')
    assert result == Failure(error=code)
    engine.dispose.assert_called_once_with()
    assert b"private" not in bridge.encode_response(result)


def test_engine_cleanup_on_success_and_unknown_result(monkeypatch, tmp_path):
    engine = Mock()
    monkeypatch.setattr(bridge, "open_store", Mock(return_value=engine))
    service = Mock(return_value=ApplicationPage(total=0, items=[]))
    monkeypatch.setattr(bridge, "execute_operation", service)
    assert bridge.handle_request(tmp_path / "synthetic.sqlite3", b'{"action":"list"}').ok
    engine.dispose.assert_called_once_with()
    engine.reset_mock()
    service.return_value = {"private": "unexpected service result"}
    assert not bridge.handle_request(tmp_path / "synthetic.sqlite3", b'{"action":"list"}').ok
    engine.dispose.assert_called_once_with()


def test_encoding_never_sends_truncated_or_oversized_private_results(monkeypatch):
    result = Success(result=ApplicationPage(total=0, items=[]))
    monkeypatch.setattr(bridge, "MAX_RESPONSE", 100)
    assert bridge.encode_response(result) == result.model_dump_json().encode()
    monkeypatch.setattr(Success, "model_dump_json", lambda _self: "private" * 100)
    assert json.loads(bridge.encode_response(result)) == Failure(error="storage").model_dump()
    monkeypatch.setattr(Success, "model_dump_json", Mock(side_effect=RuntimeError("private")))
    assert json.loads(bridge.encode_response(result)) == Failure(error="storage").model_dump()


def test_native_transport_response_budget_includes_supervisor_footer():
    from app import wsl_worker

    assert bridge.MAX_REQUEST == wsl_worker.MAX_REQUEST
    assert bridge.MAX_RESPONSE + max(map(len, wsl_worker.EXIT_MARKERS)) <= wsl_worker.MAX_RESPONSE


def test_real_pipe_preserves_wire_contract_and_rejects_ambiguous_writes(tmp_path):
    database = tmp_path / "synthetic.sqlite3"
    initialize_workspace(database).dispose()

    def call(raw):
        response = subprocess.run(  # noqa: S603 - fixed interpreter/module, synthetic data
            [sys.executable, "-I", "-m", "app.desktop_bridge", str(database)],
            input=raw,
            capture_output=True,
            timeout=10,
            check=True,
        )
        assert response.stderr == b""
        return json.loads(response.stdout)

    raw = json.dumps(
        {"action": "profile_save", "version": 0, "data": {"full_name": "Synthetic candidate"}}
    ).encode()
    result = call(raw)
    assert result["protocol_version"] == 1 and result["ok"] is True
    assert result["result"]["version"] == 1
    duplicate = b'{"action":"profile_save","version":1,"version":0,"data":{}}'
    assert call(duplicate) == Failure(error="invalid").model_dump()
    assert call(b'{"action":"profile_get"}')["result"] == result["result"]
    assert call(b'{"action":"list"}')["result"] == {"total": 0, "items": []}


def test_engine_disposal_failure_is_redacted(monkeypatch, tmp_path):
    engine = Mock()
    engine.dispose.side_effect = RuntimeError("private path and data")
    monkeypatch.setattr(bridge, "open_store", Mock(return_value=engine))
    monkeypatch.setattr(
        bridge, "execute_operation", Mock(return_value=ApplicationPage(total=0, items=[]))
    )
    assert bridge.handle_request(tmp_path / "synthetic.sqlite3", b'{"action":"list"}') == Failure(
        error="storage"
    )
