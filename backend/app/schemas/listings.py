"""Manually supplied job listings. Pasted text is untrusted source material, not instructions."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, StringConstraints, model_validator

from app.schemas.profile import Contract

Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]
Url = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=2000, pattern=r"^(|https?://\S+)$")
]
Notes = Annotated[str, StringConstraints(max_length=4000)]
Original = Annotated[str, StringConstraints(max_length=50000)]
Identity = Annotated[UUID, Field(strict=False)]
Origin = Literal["pasted", "manual"]


class ListingFields(Contract):
    title: Short = ""
    company: Short = ""
    location: Short = ""
    url: Url = ""
    source: Short = ""
    notes: Notes = ""


class ListingsListRequest(Contract):
    action: Literal["listings_list"]
    query: Annotated[str, StringConstraints(max_length=200)] = ""
    offset: int = Field(default=0, ge=0, le=100000)
    archived: bool = False


class ListingGetRequest(Contract):
    action: Literal["listing_get"]
    id: Identity


class ListingCreateRequest(Contract):
    action: Literal["listing_create"]
    id: Identity
    data: ListingFields
    original_text: Original = ""

    @model_validator(mode="after")
    def identifiable(self) -> "ListingCreateRequest":
        if self.original_text and not self.original_text.strip():
            raise ValueError("Blank listing text")
        if not (self.original_text or self.data.title or self.data.company):
            raise ValueError("A pasted listing, job title or company is required.")
        return self


class ListingUpdateRequest(Contract):
    action: Literal["listing_update"]
    id: Identity
    version: int = Field(ge=1)
    data: ListingFields
    archived: bool


class NormalizedListing(Contract):
    """Derived by fixed rules from the stored original; never owner-entered or verified."""

    rules_version: Literal[1]
    # Canonical composition can lengthen a few characters; bound the worst case explicitly.
    text: Annotated[str, StringConstraints(max_length=150000)]
    suggested_title: Annotated[str, StringConstraints(max_length=120)]
    canonical_url: Annotated[str, StringConstraints(max_length=2000)]
    links: list[Annotated[str, StringConstraints(max_length=2000)]] = Field(max_length=10)
    mentioned_work_modes: list[Literal["onsite", "hybrid", "remote"]] = Field(max_length=3)
    mentioned_employment_types: list[
        Literal["full_time", "part_time", "contract", "temporary", "internship", "traineeship"]
    ] = Field(max_length=6)


class ListingRecord(Contract):
    id: Identity
    version: int = Field(ge=1)
    origin: Origin
    data: ListingFields
    original_text: Original
    original_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    collected_at: str = Field(max_length=40)
    updated_at: str = Field(max_length=40)
    archived: bool
    normalized: NormalizedListing


class ListingSummary(Contract):
    id: Identity
    origin: Origin
    title: Short
    suggested_title: Annotated[str, StringConstraints(max_length=120)]
    company: Short
    location: Short
    collected_at: str = Field(max_length=40)
    archived: bool


class ListingPage(Contract):
    total: int = Field(ge=0)
    items: list[ListingSummary] = Field(max_length=50)
