"""Explicit, bounded input contracts shared by desktop operations and import."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Text = Annotated[str, StringConstraints(max_length=10000)]
ShortText = Annotated[str, StringConstraints(max_length=1000)]
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

    @model_validator(mode="after")
    def require_identity(self) -> "ApplicationData":
        if not (self.title.strip() or self.company.strip()):
            raise ValueError("A job title or company is required.")
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
        if set(self.original) != set(ApplicationData.model_fields) - {"status"}:
            raise ValueError("Invalid source fields")
        return self


class ApplicationRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    version: int = Field(strict=True, ge=1)
    data: ApplicationData
    updated_at: Annotated[str, StringConstraints(max_length=40)]
    imported: ImportedProvenance | None


class ApplicationSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    title: ShortText
    company: ShortText
    status: Status
    resume_sent: ShortText


class ApplicationPage(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    total: int = Field(ge=0)
    items: list[ApplicationSummary] = Field(max_length=50)
