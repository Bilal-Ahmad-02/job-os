"""Unreviewed draft contracts and source coverage; no approval is implied by validation."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StringConstraints, model_validator

from app.schemas.profile import CandidateData, Contract, Preferences

Excerpt = Annotated[str, StringConstraints(min_length=1, max_length=6000)]
Note = Annotated[str, StringConstraints(min_length=1, max_length=1000)]


class Citation(Contract):
    document_id: Annotated[UUID, Field(strict=False)]
    page: int = Field(ge=1, le=100)
    excerpt: Excerpt


class DraftEvidence(Contract):
    target: Annotated[str, StringConstraints(min_length=1, max_length=100)]
    citations: list[Citation] = Field(min_length=1, max_length=5)
    notes: list[Note] = Field(default_factory=list, max_length=8)


class DraftPayload(Contract):
    data: CandidateData
    evidence: list[DraftEvidence] = Field(min_length=1, max_length=284)
    warnings: list[Note] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def source_coverage(self) -> "DraftPayload":
        targets = {
            field
            for field in ("full_name", "headline", "location", "summary")
            if getattr(self.data, field)
        }
        for section in ("experience", "education", "skills", "projects", "certifications"):
            targets.update(f"{section}/{entry.id}" for entry in getattr(self.data, section))
        cited = [item.target for item in self.evidence]
        if len(set(cited)) != len(cited) or set(cited) != targets:
            raise ValueError("Every draft entry requires its own source evidence")
        if self.data.preferences != Preferences():
            raise ValueError("Job preferences must come from the owner, not document inference")
        if len(self.model_dump_json().encode("utf-8")) > 512 * 1024:
            raise ValueError("Draft limit")
        return self


class StoredDraft(Contract):
    created_at: Annotated[str, StringConstraints(max_length=40)]
    status: Literal["unreviewed"] = "unreviewed"
    method: Literal["assisted_import"] = "assisted_import"
    payload: DraftPayload


class DraftResponse(Contract):
    draft: StoredDraft | None


class DraftGetRequest(Contract):
    action: Literal["profile_draft_get"]
