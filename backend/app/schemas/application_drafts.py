"""Fixed-template CV and cover-letter text for one application.

A draft is rebuilt from the owner's profile each time it is asked for. It is never stored, never
sent anywhere, and no model takes part: every sentence is either fixed template wording or a
value the owner put in the profile or the dossier, and each block says which.
"""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StringConstraints

from app.schemas.profile import Contract

TEMPLATE_VERSION = 1
DraftKind = Literal["cv", "cover_letter"]
# A profile field ("summary") or one entry ("experience/<id>"), as in profile review.
Source = Annotated[str, StringConstraints(min_length=1, max_length=100)]
Gap = Literal["full_name", "summary", "experience", "education", "skills", "title", "company"]


class ApplicationDraftRequest(Contract):
    action: Literal["application_draft"]
    id: Annotated[UUID, Field(strict=False)]
    kind: DraftKind


class DraftBlock(Contract):
    """One removable piece of a draft, with where its facts came from."""

    # A section name for a CV; empty inside a letter.
    heading: Annotated[str, StringConstraints(max_length=40)]
    text: Annotated[str, StringConstraints(min_length=1, max_length=12000)]
    # Profile fields and entries whose values appear in the text. Empty: template wording only.
    sources: list[Source] = Field(max_length=120)
    # Whether the dossier's job title or company appears in the text.
    uses_application: bool


class ApplicationDraft(Contract):
    kind: DraftKind
    template_version: Literal[1]
    application_id: UUID
    application_version: int = Field(ge=1)
    profile_version: int = Field(ge=0)
    blocks: list[DraftBlock] = Field(max_length=300)
    # What a reader would expect and the profile or dossier does not have.
    gaps: list[Gap] = Field(max_length=7)
    # The owner's skills that the dossier's job text mentions, in the order they were placed.
    matched_skills: list[Annotated[str, StringConstraints(max_length=300)]] = Field(max_length=100)
