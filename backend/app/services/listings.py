"""Manual job-listing intake. No network access, parsing, matching or automatic decisions.

A listing's pasted text, its hash and its collection time are written once. Later edits change
only the owner's descriptive fields and the archive flag.
"""

import hashlib
from datetime import UTC, datetime

from sqlalchemy import Engine, func, or_, select
from sqlalchemy.orm import Session

from app.models.listings import JobListing
from app.schemas.listings import (
    ListingCreateRequest,
    ListingFields,
    ListingGetRequest,
    ListingPage,
    ListingRecord,
    ListingsListRequest,
    ListingSummary,
    ListingUpdateRequest,
)
from app.services.applications import RecordError
from app.services.listing_normalizer import normalize, normalize_text, suggested_title

MAX_LISTINGS = 2000
FIELDS = tuple(ListingFields.model_fields)


def now() -> str:
    return datetime.now(UTC).isoformat()


def record(row: JobListing) -> ListingRecord:
    return ListingRecord(
        id=row.id,
        version=row.version,
        origin=row.origin,
        data=ListingFields(**{name: getattr(row, name) for name in FIELDS}),
        original_text=row.original_text,
        original_sha256=row.original_sha256,
        collected_at=row.collected_at,
        updated_at=row.updated_at,
        archived=bool(row.archived),
        normalized=normalize(row.original_text, row.url),
    )


def list_listings(engine: Engine, request: ListingsListRequest) -> ListingPage:
    with Session(engine) as session, session.begin():
        condition = (JobListing.archived == int(request.archived)) & or_(
            JobListing.title.contains(request.query, autoescape=True),
            JobListing.company.contains(request.query, autoescape=True),
        )
        total = session.scalar(select(func.count()).select_from(JobListing).where(condition))
        rows = session.scalars(
            select(JobListing)
            .where(condition)
            .order_by(JobListing.collected_at.desc(), JobListing.id)
            .offset(request.offset)
            .limit(50)
        )
        return ListingPage(
            total=total,
            items=[
                ListingSummary(
                    id=row.id,
                    origin=row.origin,
                    title=row.title,
                    suggested_title=suggested_title(normalize_text(row.original_text)),
                    company=row.company,
                    location=row.location,
                    collected_at=row.collected_at,
                    archived=bool(row.archived),
                )
                for row in rows
            ],
        )


def get_listing(engine: Engine, request: ListingGetRequest) -> ListingRecord:
    with Session(engine) as session, session.begin():
        row = session.get(JobListing, str(request.id))
        if row is None:
            raise RecordError("not_found")
        return record(row)


def create_listing(engine: Engine, request: ListingCreateRequest) -> ListingRecord:
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        existing = session.get(JobListing, str(request.id))
        if existing is not None:
            # A retried create returns the stored listing; it never rewrites the original.
            saved = record(existing)
            if saved.original_text != request.original_text or (
                saved.version == 1 and saved.data != request.data
            ):
                raise RecordError("conflict")
            return saved
        if session.scalar(select(func.count()).select_from(JobListing)) >= MAX_LISTINGS:
            raise RecordError("invalid")
        timestamp = now()
        row = JobListing(
            id=str(request.id),
            origin="pasted" if request.original_text else "manual",
            **request.data.model_dump(),
            original_text=request.original_text,
            original_sha256=hashlib.sha256(request.original_text.encode("utf-8")).hexdigest(),
            collected_at=timestamp,
            archived=0,
            version=1,
            updated_at=timestamp,
        )
        session.add(row)
        session.flush()
        return record(row)


def update_listing(engine: Engine, request: ListingUpdateRequest) -> ListingRecord:
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        row = session.get(JobListing, str(request.id))
        if row is None:
            raise RecordError("not_found")
        if row.version != request.version:
            raise RecordError("conflict")
        if row.origin == "manual" and not (request.data.title or request.data.company):
            raise RecordError("invalid")
        for name, value in request.data.model_dump().items():
            setattr(row, name, value)
        row.archived = int(request.archived)
        row.version += 1
        row.updated_at = now()
        session.flush()
        return record(row)
