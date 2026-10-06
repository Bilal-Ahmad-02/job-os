"""Explicit, bounded input contracts shared by desktop operations and import."""

from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Text = Annotated[str, StringConstraints(max_length=10000)]
ShortText = Annotated[str, StringConstraints(max_length=1000)]
# An ISO calendar date or empty. Added after the spreadsheet import, so never part of provenance.
Day = Annotated[str, StringConstraints(max_length=10, pattern=r"^(|\d{4}-\d{2}-\d{2})$")]
DATE_FIELDS = ("deadline_date", "follow_up_date")
# Everything added after the spreadsheet import, and so never part of its provenance.
LATER_FIELDS = (*DATE_FIELDS, "preparation", "todos", "document_ids")
Status = Literal[
    "Unspecified",
    "Saved",
    "Preparing",
    "Applied",
    "Assessment",
    "Interview",
    "Offer",
    "Rejected",
    "Withdrawn",
]


def real_day(value: str) -> None:
    if value:
        date.fromisoformat(value)  # Rejects days such as 2026-02-30.


class Todo(BaseModel):
    """Something the owner means to do. A due date is only shown; nothing fires on it."""

    model_config = ConfigDict(extra="forbid", strict=True)
    title: Annotated[str, StringConstraints(min_length=1, max_length=200)]
    due_date: Day = ""
    done: bool = False

    @model_validator(mode="after")
    def require_words_and_a_real_day(self) -> "Todo":
        if not self.title.strip():
            raise ValueError("A to-do needs a title.")
        real_day(self.due_date)
        return self


class ApplicationData(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    title: ShortText = ""
    company: ShortText = ""
    website: Text = ""
    source: Text = ""
    learning: Text = ""
    resume_sent: ShortText = ""
    how_sent: Text = ""
    references_sent: Text = ""
    description: Text = ""
    status_notes: Text = ""
    interview: Text = ""
    follow_up: Text = ""
    notes: Text = ""
    status: Status = "Unspecified"
    deadline_date: Day = ""
    follow_up_date: Day = ""
    # Interview preparation notes, in the owner's words.
    preparation: Text = ""
    todos: list[Todo] = Field(default_factory=list, max_length=30)
    # Stored document versions the owner says were used. An ID names one exact, immutable file.
    document_ids: list[UUID] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def require_identity(self) -> "ApplicationData":
        if not (self.title.strip() or self.company.strip()):
            raise ValueError("A job title or company is required.")
        for name in DATE_FIELDS:
            real_day(getattr(self, name))
        if len(set(self.document_ids)) != len(self.document_ids):
            raise ValueError("A document can be linked once.")
        return self


class ListRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    action: Literal["list"]
    query: Annotated[str, StringConstraints(max_length=200)] = ""
    offset: int = Field(default=0, ge=0, le=100000)


class GetRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["get"]
    id: UUID


class SaveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["create", "update"]
    id: UUID
    version: int = Field(strict=True, ge=0)
    data: ApplicationData


Request = Annotated[ListRequest | GetRequest | SaveRequest, Field(discriminator="action")]


class ImportedProvenance(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    sheet: ShortText
    row: int = Field(ge=1)
    original: dict[str, Text] = Field(max_length=13)
    links: dict[str, Text] = Field(max_length=13)

    @model_validator(mode="after")
    def require_source_fields(self) -> "ImportedProvenance":
        if set(self.original) != set(ApplicationData.model_fields) - {"status", *LATER_FIELDS}:
            raise ValueError("Invalid source fields")
        return self


class ApplicationRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    version: int = Field(strict=True, ge=1)
    data: ApplicationData
    updated_at: Annotated[str, StringConstraints(max_length=40)]
    imported: ImportedProvenance | None
    # The collected listing this dossier was started from, if any.
    listing_id: UUID | None


class ApplicationSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    title: ShortText
    company: ShortText
    status: Status
    resume_sent: ShortText
    deadline_date: Day
    follow_up_date: Day
    open_todos: int = Field(strict=True, ge=0, le=30)


class ApplicationPage(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    total: int = Field(ge=0)
    items: list[ApplicationSummary] = Field(max_length=50)
