"""Cooperative, one-document task steps with durable progress and explicit retries.

The desktop drives steps only while unlocked. No daemon or detached process is created.
Cancellation is honored between documents; the existing supervisor bounds each admitted step.
"""

import json
import time
from datetime import UTC, datetime

from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.models.documents import SourceDocument
from app.models.tasks import BackgroundTask
from app.schemas.tasks import TaskChangeRequest, TaskCreateRequest, TaskPage, TaskRecord
from app.services.applications import RecordError
from app.services.evidence import EvidenceError, extract_document
from app.services.pdf_reader import DocumentError

LEASE_SECONDS = 120  # Exceeds both the bounded Linux worker and host cleanup deadlines.
MAX_TASKS = 100
SAFE_FAILURES = {
    "document_invalid",
    "document_timeout",
    "source_no_text",
    "source_changed",
    "source_missing",
}


def now() -> str:
    return datetime.now(UTC).isoformat()


def record(row: BackgroundTask) -> TaskRecord:
    return TaskRecord(
        **{name: getattr(row, name) for name in TaskRecord.model_fields if name != "document_ids"},
        document_ids=json.loads(row.document_ids),
    )


def update(row: BackgroundTask, state: str, error: str = "") -> None:
    row.state, row.error, row.updated_at = state, error, now()
    row.version += 1
    if state != "running":
        row.lease_until = 0


def recover(session: Session) -> None:
    stale = session.scalars(
        select(BackgroundTask).where(
            BackgroundTask.state == "running", BackgroundTask.lease_until <= int(time.time())
        )
    )
    for row in stale:
        update(row, "interrupted", "interrupted")


def list_tasks(engine: Engine) -> TaskPage:
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        recover(session)
        rows = session.scalars(
            select(BackgroundTask)
            .order_by(BackgroundTask.created_at.desc(), BackgroundTask.id)
            .limit(MAX_TASKS)
        )
        return TaskPage(items=[record(row) for row in rows])


def create_task(engine: Engine, request: TaskCreateRequest) -> TaskRecord:
    ids = [str(value) for value in request.document_ids]
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        existing = session.get(BackgroundTask, str(request.id))
        if existing is not None:
            if json.loads(existing.document_ids) != ids:
                raise RecordError("conflict")
            return record(existing)
        if session.scalar(select(func.count()).select_from(BackgroundTask)) >= MAX_TASKS:
            raise RecordError("invalid")
        if any(session.get(SourceDocument, identity) is None for identity in ids):
            raise RecordError("not_found")
        timestamp = now()
        row = BackgroundTask(
            id=str(request.id),
            kind="document_extract",
            state="queued",
            version=1,
            document_ids=json.dumps(ids),
            total=len(ids),
            completed=0,
            attempt=1,
            error="",
            lease_until=0,
            created_at=timestamp,
            updated_at=timestamp,
        )
        session.add(row)
        session.flush()
        return record(row)


def change_task(engine: Engine, request: TaskChangeRequest) -> TaskRecord:
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        recover(session)
        row = session.get(BackgroundTask, str(request.id))
        if row is None:
            raise RecordError("not_found")
        if row.version != request.version:
            raise RecordError("conflict")
        if request.action == "task_cancel":
            if row.state != "queued":
                raise RecordError("conflict")
            update(row, "cancelled")
            return record(row)
        if request.action == "task_retry":
            if row.state not in ("failed", "interrupted", "cancelled") or row.attempt >= 3:
                raise RecordError("conflict")
            row.attempt += 1
            update(row, "queued")
            return record(row)
        if request.action != "task_advance" or row.state != "queued":
            raise RecordError("conflict")
        # One parser at a time across desktop instances, with a bounded recoverable lease.
        if session.scalar(
            select(BackgroundTask.id).where(BackgroundTask.state == "running").limit(1)
        ):
            raise RecordError("conflict")
        document_id = json.loads(row.document_ids)[row.completed]
        row.lease_until = int(time.time()) + LEASE_SECONDS
        update(row, "running")
        claimed_version = row.version
    error = ""
    try:
        # Existing extraction is idempotent by immutable document ID and source hash.
        extract_document(engine, document_id, timeout=8)
    except (EvidenceError, DocumentError) as failure:
        error = str(failure) if str(failure) in SAFE_FAILURES else "storage"
    except Exception:
        error = "storage"
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        row = session.get(BackgroundTask, str(request.id))
        if row is None or row.state != "running" or row.version != claimed_version:
            raise RecordError("conflict")
        if error:
            update(row, "failed", error)
        else:
            row.completed += 1
            update(row, "succeeded" if row.completed == row.total else "queued")
        return record(row)
