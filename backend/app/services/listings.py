"""Manual job-listing intake. No network access, parsing, matching or automatic decisions.

A listing's pasted text, its hash and its collection time are written once. Later edits change
only the owner's descriptive fields and the archive and closed flags.

Possible duplicates are reported by fixed rules for the owner to review. Nothing here merges,
hides, archives, closes or deletes a listing on its own.

Review state (shortlist, dismissal, starting an application) changes only on an explicit request.
Starting an application creates one tracker dossier and links it; nothing is submitted anywhere.
"""

import hashlib
from collections import Counter
from datetime import UTC, datetime

from pydantic import ValidationError
from sqlalchemy import Engine, func, or_, select
from sqlalchemy.orm import Session

from app.models.applications import Application
from app.models.listings import JobListing, ListingSearch
from app.models.profile import Profile
from app.schemas.applications import ApplicationData
from app.schemas.listings import (
    ListingCreateRequest,
    ListingFields,
    ListingGetRequest,
    ListingMatch,
    ListingPage,
    ListingRecord,
    ListingsListRequest,
    ListingSummary,
    ListingTrackRequest,
    ListingUpdateRequest,
    SavedSearch,
    SearchDeleteRequest,
    SearchPage,
    SearchSaveRequest,
)
from app.services.applications import RecordError, insert
from app.services.listing_fit import assess, profile_terms, tally
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
from app.services.profile import record as profile_record

MAX_LISTINGS = 2000
MAX_MATCHES = 10
MAX_SEARCHES = 20
DESCRIPTION_LIMIT = 10000
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


def confirmed_profile(session: Session):
    """The owner's saved profile. Unreviewed draft evidence is never read for matching."""
    return profile_record(session.get(Profile, 1))


def record(session: Session, row: JobListing) -> ListingRecord:
    profile = confirmed_profile(session)
    normalized = normalize(row.original_text, row.url)
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
        shortlisted=bool(row.shortlisted),
        application_id=row.application_id,
        normalized=normalized,
        matches=find_matches(session, row),
        fit=assess(
            profile.data,
            profile.version,
            text=normalized.text,
            title=row.title or normalized.suggested_title,
            company=row.company,
            location=row.location,
        ),
    )


def list_listings(engine: Engine, request: ListingsListRequest) -> ListingPage:
    with Session(engine) as session, session.begin():
        untracked = JobListing.application_id.is_(None)
        view = {
            "incoming": untracked & (JobListing.archived == 0) & (JobListing.shortlisted == 0),
            "shortlist": untracked & (JobListing.archived == 0) & (JobListing.shortlisted == 1),
            "tracked": JobListing.application_id.is_not(None),
            "dismissed": untracked & (JobListing.archived == 1),
        }[request.view]
        condition = view & or_(
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
        profile = confirmed_profile(session)
        terms = profile_terms(profile.data)
        fits = {}
        titles = {}
        for row in rows:
            cleaned = normalize_text(row.original_text)
            titles[row.id] = suggested_title(cleaned)
            fits[row.id] = tally(
                assess(
                    profile.data,
                    profile.version,
                    text=cleaned,
                    title=row.title or titles[row.id],
                    company=row.company,
                    location=row.location,
                    terms=terms,
                )
            )
        return ListingPage(
            total=total,
            items=[
                ListingSummary(
                    id=row.id,
                    origin=row.origin,
                    title=row.title,
                    suggested_title=titles[row.id],
                    matched_terms=fits[row.id][0],
                    conflicts=fits[row.id][1],
                    company=row.company,
                    location=row.location,
                    collected_at=row.collected_at,
                    archived=bool(row.archived),
                    closed=bool(row.closed),
                    shortlisted=bool(row.shortlisted),
                    application_id=row.application_id,
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
        row.shortlisted = int(request.shortlisted)
        row.version += 1
        row.updated_at = now()
        session.flush()
        return record(session, row)


def track_listing(engine: Engine, request: ListingTrackRequest) -> ListingRecord:
    """Create one tracker dossier from a listing and link them. Retries return the same link."""
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        row = session.get(JobListing, str(request.id))
        if row is None:
            raise RecordError("not_found")
        application_id = str(request.application_id)
        if row.application_id is not None:
            if row.application_id != application_id:
                raise RecordError("conflict")
            return record(session, row)
        if row.version != request.version or session.get(Application, application_id):
            raise RecordError("conflict")
        cleaned = normalize_text(row.original_text)
        title = row.title or suggested_title(cleaned)
        note = (
            f"Started from a listing collected {row.collected_at[:10]}. "
            "The full original text stays in INGRESS."
        )
        if title and not row.title:
            note += " The job title was taken from the first line of the pasted text."
        if len(cleaned) > DESCRIPTION_LIMIT:
            note += " The description here is shortened to 10,000 characters."
        try:
            data = ApplicationData(
                title=title,
                company=row.company,
                website=row.url,
                source=row.source,
                description=cleaned[:DESCRIPTION_LIMIT],
                notes=note,
                status="Saved",
            )
        except ValidationError:
            # Neither a title nor a company: the owner must name the role first.
            raise RecordError("invalid") from None
        insert(session, application_id, data)
        row.application_id = application_id
        row.version += 1
        row.updated_at = now()
        session.flush()
        return record(session, row)


def search_page(session: Session) -> SearchPage:
    rows = session.scalars(
        select(ListingSearch).order_by(ListingSearch.created_at, ListingSearch.id)
    )
    return SearchPage(
        items=[
            SavedSearch(id=row.id, name=row.name, query=row.query, view=row.view) for row in rows
        ]
    )


def list_searches(engine: Engine) -> SearchPage:
    with Session(engine) as session, session.begin():
        return search_page(session)


def save_search(engine: Engine, request: SearchSaveRequest) -> SearchPage:
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        existing = session.get(ListingSearch, str(request.id))
        if existing is not None:
            if (existing.name, existing.query, existing.view) != (
                request.name,
                request.query,
                request.view,
            ):
                raise RecordError("conflict")
            return search_page(session)
        if session.scalar(select(func.count()).select_from(ListingSearch)) >= MAX_SEARCHES:
            raise RecordError("invalid")
        session.add(
            ListingSearch(
                id=str(request.id),
                name=request.name,
                query=request.query,
                view=request.view,
                created_at=now(),
            )
        )
        session.flush()
        return search_page(session)


def delete_search(engine: Engine, request: SearchDeleteRequest) -> SearchPage:
    """Removes only the named filter. Listings are never deleted."""
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        existing = session.get(ListingSearch, str(request.id))
        if existing is not None:
            session.delete(existing)
            session.flush()
        return search_page(session)
