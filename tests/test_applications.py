import json
from uuid import uuid4

import pytest
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import inspect

from app.db.store import open_store
from app.db.workspace import initialize_workspace, prepare_workspace
from app.schemas.applications import ApplicationData, GetRequest, ListRequest, Request, SaveRequest
from app.services.applications import RecordError, execute


@pytest.fixture
def store(tmp_path):
    engine = initialize_workspace(tmp_path / "oracle.sqlite3")
    yield engine
    engine.dispose()


def create(store, **values):
    return execute(
        store, SaveRequest(action="create", id=uuid4(), version=0, data=ApplicationData(**values))
    )


def test_migrations_are_repeatable_and_data_survives_restart(tmp_path):
    path = tmp_path / "oracle.sqlite3"
    first = initialize_workspace(path)
    saved = create(first, company="Example", title="Engineer", notes="Private note")
    first.dispose()
    prepare_workspace(path)
    second = open_store(path)
    try:
        assert execute(second, GetRequest(action="get", id=saved["id"])) == saved
        assert set(inspect(second).get_table_names()) == {
            "jobs",
            "applications",
            "import_batches",
            "imported_rows",
            "alembic_version",
            "workspace_metadata",
            "source_documents",
            "document_versions",
            "candidate_profile",
            "document_text",
            "profile_draft",
            "profile_review",
            "background_tasks",
            "job_listings",
        }
    finally:
        second.dispose()


def test_create_retry_and_stale_updates_do_not_duplicate_or_overwrite(store):
    request = SaveRequest(
        action="create", id=uuid4(), version=0, data=ApplicationData(company="Example")
    )
    initial = execute(store, request)
    assert execute(store, request) == initial
    assert execute(store, ListRequest(action="list"))["total"] == 1
    update = SaveRequest(
        action="update",
        id=request.id,
        version=1,
        data=ApplicationData(company="Example", status="Interview"),
    )
    changed = execute(store, update)
    assert changed["version"] == 2
    for stale in (update, request):
        with pytest.raises(RecordError, match="conflict"):
            execute(store, stale)
    assert execute(store, GetRequest(action="get", id=request.id)) == changed


def test_literal_search_pagination_and_partial_records(store):
    first = create(store, company="100%_Example", notes="'); DROP TABLE jobs; --")
    for i in range(51):
        create(store, title=f"Engineer {i:02}")
    assert execute(store, ListRequest(action="list", query="%_"))["items"][0]["id"] == first["id"]
    page = execute(store, ListRequest(action="list", query="Engineer"))
    assert page["total"] == 51 and len(page["items"]) == 50
    assert (
        len(execute(store, ListRequest(action="list", query="Engineer", offset=50))["items"]) == 1
    )
    assert execute(store, GetRequest(action="get", id=first["id"]))["data"]["title"] == ""


@pytest.mark.parametrize(
    "payload",
    [
        {"action": "delete"},
        {"action": "list", "database": "somewhere"},
        {"action": "list", "offset": -1},
        {"action": "list", "query": "x" * 201},
        {"action": "get", "id": "bad-id"},
        {"action": "create", "id": str(uuid4()), "version": 0, "data": {}},
        {
            "action": "create",
            "id": str(uuid4()),
            "version": 0,
            "data": {"company": "Example", "status": "invented"},
        },
        {
            "action": "create",
            "id": str(uuid4()),
            "version": 0,
            "data": {"company": "Example", "notes": "x" * 10001},
        },
    ],
)
def test_request_validation(payload):
    with pytest.raises(ValidationError):
        TypeAdapter(Request).validate_json(json.dumps(payload))


def test_missing_record_is_explicit(store):
    with pytest.raises(RecordError, match="not_found"):
        execute(store, GetRequest(action="get", id=uuid4()))


def test_private_data_is_not_available_through_http(client):
    for route in ("/applications", "/api/applications", "/oracle.sqlite3"):
        assert client.get(route).status_code == 404
