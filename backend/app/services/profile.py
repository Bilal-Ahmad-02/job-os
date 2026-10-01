"""Profile use cases with transaction-scoped identity and optimistic concurrency checks."""

from datetime import UTC, datetime

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.models.profile import Profile
from app.schemas.profile import CandidateData, CandidateProfile, ProfileSaveRequest


class ProfileConflict(Exception):
    """The caller's version is stale; the stored profile is unchanged."""


def record(row: Profile | None) -> CandidateProfile:
    if row is None:
        return CandidateProfile(version=0, updated_at="", data=CandidateData())
    return CandidateProfile(
        version=row.version,
        updated_at=row.updated_at,
        data=CandidateData.model_validate_json(row.data),
    )


def get_profile(engine: Engine) -> CandidateProfile:
    with Session(engine) as session, session.begin():
        return record(session.get(Profile, 1))


def save_profile(engine: Engine, request: ProfileSaveRequest) -> CandidateProfile:
    # Validate even for trusted in-process callers that mutated a Pydantic instance.
    data = CandidateData.model_validate_json(request.data.model_dump_json())
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        row = session.get(Profile, 1)
        current = record(row)
        if request.version != current.version:
            # A lost response can be retried once, only for the exact same next revision.
            if request.version + 1 == current.version and current.data == data:
                return current
            raise ProfileConflict
        if row is not None and current.data == data:
            return current
        if row is None:
            row = Profile(
                id=1,
                version=1,
                updated_at=datetime.now(UTC).isoformat(),
                data=data.model_dump_json(),
            )
            session.add(row)
        else:
            row.version += 1
            row.updated_at = datetime.now(UTC).isoformat()
            row.data = data.model_dump_json()
        session.flush()
        return record(row)
