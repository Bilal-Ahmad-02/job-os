"""Application operations, independent of HTTP or desktop transports."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import Engine, delete, func, or_, select
from sqlalchemy.orm import Session

from app.models.applications import (
    Application,
    ApplicationDocument,
    ApplicationTodo,
    ImportedRow,
    Job,
)
from app.models.documents import SourceDocument
from app.models.listings import JobListing
from app.schemas.applications import (
    ApplicationData,
    ApplicationPage,
    ApplicationRecord,
    ApplicationSummary,
    GetRequest,
    ListRequest,
    SaveRequest,
)

JOB_FIELDS = ("title", "company", "website", "source", "learning", "description")
# Kept in rows of their own; every save replaces them with what the owner sent.
LIST_FIELDS = ("todos", "document_ids")


class RecordError(Exception):
    """An expected error, containing only a fixed public error code."""


def now() -> str:
    return datetime.now(UTC).isoformat()


def replace_lists(session: Session, identity: str, data: ApplicationData) -> None:
    """Store the to-do items and document links exactly as given, in the owner's order."""
    documents = [str(document) for document in data.document_ids]
    known = session.scalars(select(SourceDocument.id).where(SourceDocument.id.in_(documents)))
    if set(known) != set(documents):
        raise RecordError("invalid")
    for table in (ApplicationTodo, ApplicationDocument):
        session.execute(delete(table).where(table.application_id == identity))
    session.add_all(
        ApplicationTodo(
            application_id=identity,
            position=position,
            title=todo.title,
            due_date=todo.due_date,
            done=int(todo.done),
        )
        for position, todo in enumerate(data.todos)
    )
    session.add_all(
        ApplicationDocument(application_id=identity, position=position, document_id=document)
        for position, document in enumerate(documents)
    )
    session.flush()


def insert(session: Session, identity: str, data: ApplicationData) -> Application:
    values = data.model_dump(exclude=set(LIST_FIELDS))
    job = Job(id=str(uuid4()), **{key: values.pop(key) for key in JOB_FIELDS})
    session.add(job)
    session.flush()
    application = Application(
        id=identity,
        job_id=job.id,
        **values,
        version=1,
        updated_at=now(),
    )
    session.add(application)
    session.flush()
    replace_lists(session, identity, data)
    return application


def detail(session: Session, identity: str) -> ApplicationRecord:
    application = session.get(Application, identity)
    if application is None:
        raise RecordError("not_found")
    job = session.get(Job, application.job_id)
    values: dict = {
        key: getattr(job if key in JOB_FIELDS else application, key)
        for key in ApplicationData.model_fields
        if key not in LIST_FIELDS
    }
    values["todos"] = [
        {"title": todo.title, "due_date": todo.due_date, "done": bool(todo.done)}
        for todo in session.scalars(
            select(ApplicationTodo)
            .where(ApplicationTodo.application_id == identity)
            .order_by(ApplicationTodo.position)
        )
    ]
    values["document_ids"] = [
        UUID(document)
        for document in session.scalars(
            select(ApplicationDocument.document_id)
            .where(ApplicationDocument.application_id == identity)
            .order_by(ApplicationDocument.position)
        )
    ]
    imported = session.scalar(select(ImportedRow).where(ImportedRow.application_id == identity))
    return ApplicationRecord.model_validate(
        {
            "id": identity,
            "version": application.version,
            "data": values,
            "updated_at": application.updated_at,
            "imported": None
            if imported is None
            else {
                "sheet": imported.sheet,
                "row": imported.row_number,
                "original": imported.original,
                "links": imported.links,
            },
            "listing_id": session.scalar(
                select(JobListing.id).where(JobListing.application_id == identity)
            ),
        }
    )


def list_applications(engine: Engine, request: ListRequest) -> ApplicationPage:
    with Session(engine) as session, session.begin():
        condition = or_(
            Job.title.contains(request.query, autoescape=True),
            Job.company.contains(request.query, autoescape=True),
        )
        total = session.scalar(
            select(func.count()).select_from(Application).join(Job).where(condition)
        )
        rows = session.execute(
            select(Application, Job)
            .join(Job)
            .where(condition)
            .order_by(Job.company.collate("NOCASE"), Job.title, Application.id)
            .offset(request.offset)
            .limit(50)
        ).all()
        unfinished = dict(
            session.execute(
                select(ApplicationTodo.application_id, func.count())
                .where(
                    ApplicationTodo.application_id.in_([a.id for a, _ in rows]),
                    ApplicationTodo.done == 0,
                )
                .group_by(ApplicationTodo.application_id)
            ).all()
        )
        return ApplicationPage(
            total=total,
            items=[
                ApplicationSummary(
                    id=a.id,
                    title=j.title,
                    company=j.company,
                    status=a.status,
                    resume_sent=a.resume_sent,
                    deadline_date=a.deadline_date,
                    follow_up_date=a.follow_up_date,
                    open_todos=unfinished.get(a.id, 0),
                )
                for a, j in rows
            ],
        )


def get_application(engine: Engine, request: GetRequest) -> ApplicationRecord:
    with Session(engine) as session, session.begin():
        return detail(session, str(request.id))


def save_application(engine: Engine, request: SaveRequest) -> ApplicationRecord:
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        identity = str(request.id)
        application = session.get(Application, identity)
        if request.action == "create":
            if request.version != 0:
                raise RecordError("invalid")
            if application is not None:
                result = detail(session, identity)
                if result.data != request.data:
                    raise RecordError("conflict")
                return result
            insert(session, identity, request.data)
        else:
            if application is None:
                raise RecordError("not_found")
            if application.version != request.version:
                raise RecordError("conflict")
            job = session.get(Job, application.job_id)
            for key, value in request.data.model_dump(exclude=set(LIST_FIELDS)).items():
                setattr(job if key in JOB_FIELDS else application, key, value)
            replace_lists(session, identity, request.data)
            application.version += 1
            application.updated_at = now()
            session.flush()
        return detail(session, identity)


def execute(engine: Engine, request: ListRequest | GetRequest | SaveRequest) -> dict:
    """Compatibility adapter for existing CLI/import callers; use cases return typed results."""
    if isinstance(request, ListRequest):
        result = list_applications(engine, request)
    elif isinstance(request, GetRequest):
        result = get_application(engine, request)
    elif isinstance(request, SaveRequest):
        result = save_application(engine, request)
    else:
        raise ValueError("Unsupported application operation")
    return result.model_dump(mode="json")
