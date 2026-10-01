"""Atomic owner approval: preserve originals and unrelated candidate fields."""

import hashlib
import json
from datetime import UTC, datetime

from pydantic import TypeAdapter
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.models.evidence import ProfileDraft
from app.models.profile import Profile
from app.models.review import ProfileReview
from app.schemas.evidence import DraftPayload, StoredDraft
from app.schemas.profile import CandidateData
from app.schemas.review import ReviewDecision, ReviewSaveRequest, ReviewState
from app.services.profile import ProfileConflict, record

SCALARS = ("full_name", "headline", "location", "summary")
SECTIONS = ("experience", "education", "skills", "projects", "certifications")


def state(session: Session) -> ReviewState:
    draft = session.get(ProfileDraft, 1)
    review = session.get(ProfileReview, 1)
    return ReviewState(
        version=review.version if review else 0,
        draft_sha256=hashlib.sha256(draft.payload.encode()).hexdigest() if draft else "",
        draft=StoredDraft(
            created_at=draft.created_at, payload=DraftPayload.model_validate_json(draft.payload)
        )
        if draft
        else None,
        profile=record(session.get(Profile, 1)),
        decisions=TypeAdapter(list[ReviewDecision]).validate_json(review.decisions)
        if review
        else [],
    )


def get_review(engine: Engine) -> ReviewState:
    with Session(engine) as session, session.begin():
        return state(session)


def single_entry(data: CandidateData, target: str) -> tuple[str, object]:
    """Reject requests that could smuggle unrelated edits into a single approval."""
    minimal = CandidateData()
    if target in SCALARS:
        value = getattr(data, target)
        if not value.strip():
            raise ValueError("Empty approved field")
        setattr(minimal, target, value)
        section = target
    else:
        section, identity = target.split("/", 1)
        if section not in SECTIONS:
            raise ValueError("Unknown section")
        entries = getattr(data, section)
        if len(entries) != 1 or str(entries[0].id) != identity:
            raise ValueError("Entry identity mismatch")
        value = entries[0]
        setattr(minimal, section, entries)
    if minimal != data:
        raise ValueError("Unrelated fields in approval")
    return section, value


def save_review(engine: Engine, request: ReviewSaveRequest) -> ReviewState:
    request = ReviewSaveRequest.model_validate_json(request.model_dump_json())
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        current = state(session)
        if (
            request.version != current.version
            or request.profile_version != current.profile.version
            or request.draft_sha256 != current.draft_sha256
        ):
            raise ProfileConflict
        if current.draft is None or request.target not in {
            item.target for item in current.draft.payload.evidence
        }:
            raise ValueError("Unknown draft target")
        prior = next((item for item in current.decisions if item.target == request.target), None)
        # Approved entries are edited through approval again; rejection never deletes profile data.
        if request.decision == "rejected" and (
            request.data is not None or (prior and prior.decision == "approved")
        ):
            raise ValueError("Cannot reject an already approved entry")
        now = datetime.now(UTC).isoformat()
        if request.decision == "approved":
            if request.data is None:
                raise ValueError("Approval requires data")
            section, value = single_entry(request.data, request.target)
            merged = current.profile.data.model_copy(deep=True)
            if section in SCALARS:
                setattr(merged, section, value)
            else:
                entries = getattr(merged, section)
                position = next((i for i, item in enumerate(entries) if item.id == value.id), None)
                if position is None:
                    entries.append(value)
                else:
                    entries[position] = value
            merged = CandidateData.model_validate_json(merged.model_dump_json())
            row = session.get(Profile, 1)
            if row is None:
                session.add(Profile(id=1, version=1, updated_at=now, data=merged.model_dump_json()))
            elif current.profile.data != merged:
                row.version += 1
                row.updated_at = now
                row.data = merged.model_dump_json()
        decisions = [item for item in current.decisions if item.target != request.target]
        decisions.append(
            ReviewDecision(target=request.target, decision=request.decision, reviewed_at=now)
        )
        payload = json.dumps([item.model_dump() for item in decisions])
        row = session.get(ProfileReview, 1)
        if row is None:
            session.add(ProfileReview(id=1, version=1, decisions=payload))
        else:
            row.version += 1
            row.decisions = payload
        session.flush()
        return state(session)
