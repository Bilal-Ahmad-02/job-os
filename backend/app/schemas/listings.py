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
# incoming: not dismissed, shortlisted or tracked. tracked: an application was started from it.
View = Literal["incoming", "shortlist", "tracked", "dismissed"]
Query = Annotated[str, StringConstraints(max_length=200)]


class ListingFields(Contract):
    title: Short = ""
    company: Short = ""
    location: Short = ""
    url: Url = ""
    source: Short = ""
    notes: Notes = ""


class ListingsListRequest(Contract):
    action: Literal["listings_list"]
    query: Query = ""
    offset: int = Field(default=0, ge=0, le=100000)
    view: View = "incoming"


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
    closed: bool
    shortlisted: bool


class ListingTrackRequest(Contract):
    """Start an application dossier from a listing. The client supplies the new dossier ID."""

    action: Literal["listing_track"]
    id: Identity
    version: int = Field(ge=1)
    application_id: Identity


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


MatchReason = Literal["same_text", "same_link", "same_title_company"]


class ListingMatch(Contract):
    """Another stored listing that fixed rules flag as possibly the same role. Never merged."""

    id: Identity
    title: Short
    company: Short
    collected_at: str = Field(max_length=40)
    archived: bool
    closed: bool
    reasons: list[MatchReason] = Field(min_length=1, max_length=3)


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
    closed: bool
    shortlisted: bool
    application_id: Identity | None
    normalized: NormalizedListing
    matches: list[ListingMatch] = Field(max_length=10)


class ListingSummary(Contract):
    id: Identity
    origin: Origin
    title: Short
    suggested_title: Annotated[str, StringConstraints(max_length=120)]
    company: Short
    location: Short
    collected_at: str = Field(max_length=40)
    archived: bool
    closed: bool
    shortlisted: bool
    application_id: Identity | None
    possible_duplicate: bool


class ListingPage(Contract):
    total: int = Field(ge=0)
    items: list[ListingSummary] = Field(max_length=50)


class SavedSearch(Contract):
    id: Identity
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    query: Query
    view: View


class SearchListRequest(Contract):
    action: Literal["listing_searches_list"]


class SearchSaveRequest(SavedSearch):
    action: Literal["listing_search_save"]


class SearchDeleteRequest(Contract):
    action: Literal["listing_search_delete"]
    id: Identity


class SearchPage(Contract):
    items: list[SavedSearch] = Field(max_length=20)
