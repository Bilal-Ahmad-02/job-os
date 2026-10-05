"""Manual job-listing intake. No network access, parsing, matching or automatic decisions.

A listing's pasted text, its hash and its collection time are written once. Later edits change
only the owner's descriptive fields and the archive and closed flags.

Possible duplicates are reported by fixed rules for the owner to review. Nothing here merges,
hides, archives, closes or deletes a listing on its own.
"""

import hashlib
from collections import Counter
from datetime import UTC, datetime

from sqlalchemy import Engine, func, or_, select
from sqlalchemy.orm import Session

from app.models.listings import JobListing
from app.schemas.listings import (
    ListingCreateRequest,
    ListingFields,
    ListingGetRequest,
    ListingMatch,
    ListingPage,
    ListingRecord,
    ListingsListRequest,
    ListingSummary,
    ListingUpdateRequest,
)
from app.services.applications import RecordError
from app.services.listing_normalizer import (
    KEYS_VERSION,
    canonical_url,
    company_key,
    label_key,
    normalize,
    normalize_text,
    suggested_title,
    text_key,
)

MAX_LISTINGS = 2000
MAX_MATCHES = 10
FIELDS = tuple(ListingFields.model_fields)
REASONS = ("same_text", "same_link", "same_title_company")
COMPARED = (
    JobListing.id,
    JobListing.title,
    JobListing.company,
    JobListing.url,
    JobListing.text_key,
    JobListing.keys_version,
    JobListing.collected_at,
    JobListing.archived,
    JobListing.closed,
)


def now() -> str:
    return datetime.now(UTC).isoformat()


def signature(item) -> tuple[str, str, str]:
    """Comparison keys in REASONS order; an empty key never matches anything."""
    title, company = label_key(item.title), company_key(item.company)
    return (
        item.text_key if item.keys_version == KEYS_VERSION else "",
        canonical_url(item.url),
        f"{title}\n{company}" if title and company else "",
    )


def find_matches(session: Session, row: JobListing) -> list[ListingMatch]:
    own = signature(row)
    found = []
    for item in session.execute(select(*COMPARED).where(JobListing.id != row.id)):
        reasons = [
            name
            for name, mine, theirs in zip(REASONS, own, signature(item), strict=True)
            if mine and mine == theirs
        ]
        if reasons:
            found.append((item, reasons))
    found.sort(key=lambda pair: (pair[0].collected_at, pair[0].id), reverse=True)
    found.sort(key=lambda pair: "same_text" not in pair[1])
    return [
        ListingMatch(
            id=item.id,
            title=item.title,
            company=item.company,
            collected_at=item.collected_at,
            archived=bool(item.archived),
            closed=bool(item.closed),
            reasons=reasons,
        )
        for item, reasons in found[:MAX_MATCHES]
    ]


def record(session: Session, row: JobListing) -> ListingRecord:
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
        closed=bool(row.closed),
        normalized=normalize(row.original_text, row.url),
        matches=find_matches(session, row),
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
        ).all()
        # A key shared by two or more stored listings marks each of them for review.
        signatures = {item.id: signature(item) for item in session.execute(select(*COMPARED))}
        shared = [
            {key for key, count in Counter(keys).items() if key and count > 1}
            for keys in zip(*signatures.values(), strict=True)
        ] or [set(), set(), set()]
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
                    closed=bool(row.closed),
                    possible_duplicate=any(
                        key in group for key, group in zip(signatures[row.id], shared, strict=True)
                    ),
                )
                for row in rows
            ],
        )


def get_listing(engine: Engine, request: ListingGetRequest) -> ListingRecord:
    with Session(engine) as session, session.begin():
        row = session.get(JobListing, str(request.id))
        if row is None:
            raise RecordError("not_found")
        return record(session, row)


def create_listing(engine: Engine, request: ListingCreateRequest) -> ListingRecord:
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        existing = session.get(JobListing, str(request.id))
        if existing is not None:
            # A retried create returns the stored listing; it never rewrites the original.
            saved = record(session, existing)
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
            text_key=text_key(request.original_text),
            keys_version=KEYS_VERSION,
            closed=0,
            archived=0,
            version=1,
            updated_at=timestamp,
        )
        session.add(row)
        session.flush()
        return record(session, row)


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
        row.closed = int(request.closed)
        row.version += 1
        row.updated_at = now()
        session.flush()
        return record(session, row)
