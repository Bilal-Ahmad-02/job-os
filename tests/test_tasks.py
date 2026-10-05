from concurrent.futures import ThreadPoolExecutor
from threading import Event
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.orm import Session
from test_evidence import text_pdf

from app.db.store import open_store
from app.db.workspace import initialize_workspace, prepare_workspace
from app.models.evidence import DocumentText
from app.models.tasks import BackgroundTask
from app.schemas.tasks import TaskChangeRequest, TaskCreateRequest
from app.services import tasks
from app.services.applications import RecordError
from app.services.backup_snapshot import snapshot_workspace, verify_snapshot
from app.services.documents import import_documents, read_document
from app.services.evidence import extract_document
from app.services.pdf_reader import DocumentError


@pytest.fixture
def workspace(tmp_path):
    database = tmp_path / "oracle.sqlite3"
    engine = initialize_workspace(database)
    sources = []
    for index in range(2):
        path = tmp_path / f"synthetic-{index}.pdf"
        text_pdf(path, text=f"Synthetic source {index}")
        sources.append(import_documents(engine, [read_document("cv", path)])[0])
    try:
        yield engine, database, sources
    finally:
        engine.dispose()


def create(engine, sources):
    return tasks.create_task(
        engine, TaskCreateRequest(action="task_create", id=uuid4(), document_ids=sources)
    )


def change(engine, row, action):
    return tasks.change_task(
        engine, TaskChangeRequest(action=action, id=row.id, version=row.version)
    )


def test_task_progress_idempotent_creation_and_existing_extraction(workspace):
    engine, _, sources = workspace
    row = create(engine, sources)
    assert row.state == "queued" and row.completed == 0
    same = tasks.create_task(
        engine, TaskCreateRequest(action="task_create", id=row.id, document_ids=sources)
    )
    assert same == row
    with pytest.raises(RecordError, match="conflict"):
        tasks.create_task(
            engine,
            TaskCreateRequest(
                action="task_create", id=row.id, document_ids=list(reversed(sources))
            ),
        )
    extract_document(engine, sources[0])
    row = change(engine, row, "task_advance")
    assert row.state == "queued" and row.completed == 1
    row = change(engine, row, "task_advance")
    assert row.state == "succeeded" and row.completed == 2
    with Session(engine) as session:
        assert len(session.query(DocumentText).all()) == 2


def test_cancel_stops_next_document_and_explicit_retry_keeps_progress(workspace):
    engine, _, sources = workspace
    row = change(engine, create(engine, sources), "task_advance")
    row = change(engine, row, "task_cancel")
    assert row.state == "cancelled" and row.completed == 1
    with pytest.raises(RecordError, match="conflict"):
        change(engine, row, "task_advance")
    row = change(engine, row, "task_retry")
    assert row.attempt == 2 and row.completed == 1
    assert change(engine, row, "task_advance").state == "succeeded"


def test_timeouts_have_no_automatic_retries_and_attempts_are_bounded(workspace, monkeypatch):
    engine, _, sources = workspace
    calls = []

    def timeout(*args, **kwargs):
        calls.append(kwargs)
        raise DocumentError("document_timeout")

    monkeypatch.setattr(tasks, "extract_document", timeout)
    row = create(engine, sources)
    for attempt in (1, 2, 3):
        row = change(engine, row, "task_advance")
        assert row.state == "failed" and row.error == "document_timeout" and row.attempt == attempt
        assert len(calls) == attempt and calls[-1] == {"timeout": 8}
        if attempt < 3:
            row = change(engine, row, "task_retry")
    with pytest.raises(RecordError, match="conflict"):
        change(engine, row, "task_retry")


def test_crash_after_extraction_is_recovered_without_duplicating_evidence(workspace, monkeypatch):
    engine, _, sources = workspace
    row = create(engine, sources)

    def crash_after_commit(engine, identity, **kwargs):
        extract_document(engine, identity, **kwargs)
        raise SystemExit("simulated worker death")

    monkeypatch.setattr(tasks, "extract_document", crash_after_commit)
    with pytest.raises(SystemExit):
        change(engine, row, "task_advance")
    assert tasks.list_tasks(engine).items[0].state == "running"
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        session.get(BackgroundTask, str(row.id)).lease_until = 1
    recovered = tasks.list_tasks(engine).items[0]
    assert recovered.state == "interrupted" and recovered.completed == 0
    monkeypatch.setattr(tasks, "extract_document", extract_document)
    resumed = change(engine, recovered, "task_retry")
    resumed = change(engine, resumed, "task_advance")
    assert resumed.completed == 1
    with Session(engine) as session:
        assert len(session.query(DocumentText).all()) == 1


def test_concurrent_desktops_cannot_run_a_second_parser(workspace, monkeypatch):
    engine, _, sources = workspace
    first, second = create(engine, sources), create(engine, sources)
    started, release = Event(), Event()

    def slow(*args, **kwargs):
        started.set()
        assert release.wait(5)
        return 1

    monkeypatch.setattr(tasks, "extract_document", slow)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(change, engine, first, "task_advance")
        try:
            assert started.wait(5)
            assert (
                next(row for row in tasks.list_tasks(engine).items if row.id == first.id).state
                == "running"
            )
            with pytest.raises(RecordError, match="conflict"):
                change(engine, second, "task_advance")
            with pytest.raises(RecordError, match="conflict"):
                change(engine, first, "task_cancel")
        finally:
            release.set()
        assert future.result().completed == 1


def test_unknown_errors_are_redacted_and_stale_versions_never_advance(workspace, monkeypatch):
    engine, _, sources = workspace
    row = create(engine, sources)

    def fail(*args, **kwargs):
        raise RuntimeError("private document contents and path")

    monkeypatch.setattr(tasks, "extract_document", fail)
    result = change(engine, row, "task_advance")
    assert result.error == "storage" and "private" not in result.model_dump_json()
    with pytest.raises(RecordError, match="conflict"):
        change(engine, row, "task_advance")


def test_limits_and_source_validation(workspace, monkeypatch):
    engine, _, sources = workspace
    with pytest.raises(ValidationError):
        TaskCreateRequest(action="task_create", id=uuid4(), document_ids=[sources[0], sources[0]])
    with pytest.raises(RecordError, match="not_found"):
        create(engine, [uuid4()])
    monkeypatch.setattr(tasks, "MAX_TASKS", 1)
    create(engine, sources)
    with pytest.raises(RecordError, match="invalid"):
        create(engine, sources)


def test_task_progress_survives_snapshot_and_explicit_preparation(workspace, tmp_path):
    engine, database, sources = workspace
    row = change(engine, create(engine, sources), "task_advance")
    snapshot = tmp_path / "snapshot"
    snapshot_workspace(database, snapshot)
    verify_snapshot(snapshot)
    prepare_workspace(snapshot / "oracle.sqlite3")
    restored = open_store(snapshot / "oracle.sqlite3")
    try:
        assert tasks.list_tasks(restored).items == [row]
        assert change(restored, row, "task_advance").state == "succeeded"
    finally:
        restored.dispose()


def test_migration_from_0007_preserves_existing_rows(tmp_path):
    database = tmp_path / "oracle.sqlite3"
    engine = initialize_workspace(database)
    with engine.connect().execution_options(oracle_write=True) as connection, connection.begin():
        connection.exec_driver_sql("DROP TABLE listing_searches")
        connection.exec_driver_sql("DROP TABLE job_listings")
        connection.exec_driver_sql("DROP TABLE background_tasks")
        connection.exec_driver_sql("UPDATE alembic_version SET version_num='0007'")
    engine.dispose()
    prepare_workspace(database)
    restored = open_store(database)
    try:
        assert tasks.list_tasks(restored).items == []
        with restored.connect() as connection:
            assert (
                connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
                == "0011"
            )
    finally:
        restored.dispose()
    assert list((tmp_path / "migration-backups").glob("*.sqlite3"))
