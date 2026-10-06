"""Synthetic checks for to-do items, preparation notes and document links on applications."""

import hashlib
import json
from uuid import UUID, uuid4

import pytest
from pydantic import TypeAdapter, ValidationError
from sqlalchemy import text
from test_listing_review import workspace_at

from app.db.store import existing_engine, open_store
from app.db.workspace import initialize_workspace, prepare_workspace
from app.schemas.applications import (
    ApplicationData,
    GetRequest,
    ListRequest,
    SaveRequest,
    Todo,
)
from app.schemas.desktop import DesktopRequest
from app.services.applications import (
    RecordError,
    get_application,
    list_applications,
    save_application,
)
from app.services.documents import PreparedDocument, import_documents


@pytest.fixture
def store(tmp_path):
    engine = initialize_workspace(tmp_path / "oracle.sqlite3")
    try:
        yield engine
    finally:
        engine.dispose()


def save(engine, identity, version, **data):
    return save_application(
        engine,
        SaveRequest(
            action="update" if version else "create",
            id=identity,
            version=version,
            data=ApplicationData(company="Example AB", **data),
        ),
    )


def document(engine, label, *, replaces=None):
    """Store a synthetic file as a document version and return its identifier."""
    content = b"%PDF-1.4 synthetic " + label.encode()
    prepared = PreparedDocument(
        f"{label}.pdf", "cv", content, hashlib.sha256(content).hexdigest(), 1
    )
    stored = import_documents(engine, [prepared], replaces=replaces and str(replaces))
    return UUID(stored[0])


def test_todos_keep_their_order_and_state_and_are_replaced_by_each_save(store):
    identity = uuid4()
    todos = [
        Todo(title="Ask a referee", due_date="2026-10-12"),
        Todo(title="Send the form", done=True),
        Todo(title="Research the team"),
    ]
    created = save(store, identity, 0, todos=todos, preparation="Revise queues and caching.")
    assert created.data.todos == todos
    assert created.data.preparation == "Revise queues and caching."
    assert list_applications(store, ListRequest(action="list")).items[0].open_todos == 2
    # Ticking one, dropping one and reordering are all just the next saved list.
    changed = save(
        store,
        identity,
        1,
        todos=[todos[2], todos[0].model_copy(update={"done": True})],
        preparation="Revise queues and caching.",
    )
    assert [(todo.title, todo.done) for todo in changed.data.todos] == [
        ("Research the team", False),
        ("Ask a referee", True),
    ]
    assert list_applications(store, ListRequest(action="list")).items[0].open_todos == 1
    cleared = save(store, identity, 2)
    assert cleared.data.todos == [] and cleared.data.preparation == ""
    assert get_application(store, GetRequest(action="get", id=identity)) == cleared
    with store.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM application_todos")).scalar() == 0


def test_todos_belong_to_one_application_and_a_stale_save_changes_nothing(store):
    first, second = uuid4(), uuid4()
    save(store, first, 0, todos=[Todo(title="First only")])
    save(store, second, 0, todos=[Todo(title="Second only"), Todo(title="Also second")])
    with pytest.raises(RecordError, match="conflict"):
        save(store, first, 7, todos=[])
    assert get_application(store, GetRequest(action="get", id=first)).data.todos == [
        Todo(title="First only")
    ]
    listed = list_applications(store, ListRequest(action="list")).items
    counts = {item.id: item.open_todos for item in listed}
    assert counts == {first: 1, second: 2}


@pytest.mark.parametrize(
    "todo",
    [
        {"title": ""},
        {"title": "   "},
        {"title": "x" * 201},
        {"title": "Call", "due_date": "2026-02-30"},
        {"title": "Call", "due_date": "soon"},
        {"title": "Call", "done": 1},
        {"title": "Call", "owner": "someone"},
    ],
)
def test_malformed_todos_are_rejected(todo):
    with pytest.raises(ValidationError):
        ApplicationData(company="Example AB", todos=[todo])


def test_limits_on_how_much_one_application_can_hold():
    assert len(ApplicationData(company="A", todos=[Todo(title="t")] * 30).todos) == 30
    with pytest.raises(ValidationError):
        ApplicationData(company="A", todos=[Todo(title="t")] * 31)
    with pytest.raises(ValidationError):
        ApplicationData(company="A", document_ids=[uuid4() for _ in range(11)])
    with pytest.raises(ValidationError):
        ApplicationData(company="A", preparation="x" * 10001)
    repeated = uuid4()
    with pytest.raises(ValidationError):
        ApplicationData(company="A", document_ids=[repeated, repeated])


def test_a_link_names_the_exact_version_and_survives_a_newer_one(store):
    original = document(store, "cv-first")
    identity = uuid4()
    linked = save(store, identity, 0, document_ids=[original])
    assert linked.data.document_ids == [original]
    # A later version of the same document does not move the link.
    newer = document(store, "cv-second", replaces=original)
    assert newer != original
    again = get_application(store, GetRequest(action="get", id=identity))
    assert again.data.document_ids == [original]
    both = save(store, identity, 1, document_ids=[newer, original])
    assert both.data.document_ids == [newer, original]
    unlinked = save(store, identity, 2)
    assert unlinked.data.document_ids == []
    # Unlinking removes the link only; both stored versions are untouched.
    with store.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM source_documents")).scalar() == 2


def test_linking_a_document_that_is_not_stored_is_refused_and_saves_nothing(store):
    identity = uuid4()
    with pytest.raises(RecordError, match="invalid"):
        save(store, identity, 0, document_ids=[uuid4()])
    with pytest.raises(RecordError, match="not_found"):
        get_application(store, GetRequest(action="get", id=identity))
    kept = save(store, identity, 0, notes="Kept", todos=[Todo(title="Kept")])
    with pytest.raises(RecordError, match="invalid"):
        save(store, identity, 1, notes="Lost", document_ids=[uuid4()], todos=[])
    assert get_application(store, GetRequest(action="get", id=identity)) == kept


def test_the_desktop_request_carries_the_new_fields_as_plain_json(store):
    stored = document(store, "cv-wire")
    identity = uuid4()
    request = TypeAdapter(DesktopRequest).validate_json(
        json.dumps(
            {
                "action": "create",
                "id": str(identity),
                "version": 0,
                "data": {
                    "company": "Example AB",
                    "preparation": "Notes",
                    "todos": [{"title": "Call", "due_date": "2026-10-20", "done": False}],
                    "document_ids": [str(stored)],
                },
            }
        )
    )
    record = save_application(store, request)
    assert record.data.todos == [Todo(title="Call", due_date="2026-10-20")]
    assert record.model_dump(mode="json")["data"]["document_ids"] == [str(stored)]


def test_migration_from_0012_keeps_every_application_value_and_adds_empty_work(tmp_path):
    database = tmp_path / "oracle.sqlite3"
    workspace_at(database, "0012")
    application, job = str(uuid4()), str(uuid4())
    engine = existing_engine(database)
    try:
        with engine.connect().execution_options(oracle_write=True) as connection:
            with connection.begin():
                connection.execute(
                    text(
                        "INSERT INTO jobs (id, title, company, website, source, learning, "
                        "description) VALUES (:job, 'Engineer', 'Example AB', '', '', '', 'Text')"
                    ),
                    {"job": job},
                )
                connection.execute(
                    text(
                        "INSERT INTO applications (id, job_id, resume_sent, how_sent, "
                        "references_sent, status_notes, interview, follow_up, notes, status, "
                        "version, updated_at, deadline_date, follow_up_date) VALUES (:id, :job, "
                        "'2026-09-01', '', '', '', 'Panel on Tuesday', '', 'Owner note', "
                        "'Interview', 6, '2026-10-01T00:00:00+00:00', '2026-10-20', '')"
                    ),
                    {"id": application, "job": job},
                )
    finally:
        engine.dispose()
    prepare_workspace(database)
    assert list((tmp_path / "migration-backups").glob("before-0013-*.sqlite3"))
    upgraded = open_store(database)
    try:
        row = get_application(upgraded, GetRequest(action="get", id=application))
        assert row.version == 6 and row.updated_at == "2026-10-01T00:00:00+00:00"
        assert (row.data.status, row.data.interview, row.data.notes, row.data.deadline_date) == (
            "Interview",
            "Panel on Tuesday",
            "Owner note",
            "2026-10-20",
        )
        assert (row.data.preparation, row.data.todos, row.data.document_ids) == ("", [], [])
        assert list_applications(upgraded, ListRequest(action="list")).items[0].open_todos == 0
    finally:
        upgraded.dispose()
