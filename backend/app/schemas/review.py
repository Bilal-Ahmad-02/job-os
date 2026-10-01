"""Explicit per-entry owner decisions, distinct from external credential verification."""

from typing import Annotated, Literal

from pydantic import Field, StringConstraints

from app.schemas.evidence import StoredDraft
from app.schemas.profile import CandidateData, CandidateProfile, Contract

Target = Annotated[str, StringConstraints(min_length=1, max_length=100)]


class ReviewGetRequest(Contract):
    action: Literal["profile_review_get"]


class ReviewSaveRequest(Contract):
    action: Literal["profile_review_save"]
    version: int = Field(ge=0)
    profile_version: int = Field(ge=0)
    draft_sha256: Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{64}$")]
    target: Target
    decision: Literal["approved", "rejected"]
    data: CandidateData | None = None


class ReviewDecision(Contract):
    target: Target
    decision: Literal["approved", "rejected"]
    reviewed_at: str


class ReviewState(Contract):
    version: int = Field(ge=0)
    draft_sha256: str
    draft: StoredDraft | None
    profile: CandidateProfile
    decisions: list[ReviewDecision] = Field(max_length=284)
