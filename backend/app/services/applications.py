"""Application operations, independent of HTTP or desktop transports."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Engine, func, or_, select
from sqlalchemy.orm import Session

from app.models.applications import Application, ImportedRow, Job
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


class RecordError(Exception):
    """An expected error, containing only a fixed public error code."""


def now() -> str:
    return datetime.now(UTC).isoformat()


def insert(session: Session, identity: str, data: ApplicationData) -> Application:
    values = data.model_dump()
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
    return application


def detail(session: Session, identity: str) -> ApplicationRecord:
    application = session.get(Application, identity)
    if application is None:
        raise RecordError("not_found")
    job = session.get(Job, application.job_id)
    values = {
        key: getattr(job if key in JOB_FIELDS else application, key)
        for key in ApplicationData.model_fields
    }
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
            for key, value in request.data.model_dump().items():
                setattr(job if key in JOB_FIELDS else application, key, value)
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
