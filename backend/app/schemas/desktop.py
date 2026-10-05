"""Versioned response envelope for private native IPC; no raw exceptions."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.applications import (
    ApplicationPage,
    ApplicationRecord,
    GetRequest,
    ListRequest,
    SaveRequest,
)
from app.schemas.documents import DocumentListRequest, DocumentPage
from app.schemas.evidence import DraftGetRequest, DraftResponse
from app.schemas.listings import (
    ListingCreateRequest,
    ListingGetRequest,
    ListingPage,
    ListingRecord,
    ListingsListRequest,
    ListingTrackRequest,
    ListingUpdateRequest,
    SearchDeleteRequest,
    SearchListRequest,
    SearchPage,
    SearchSaveRequest,
)
from app.schemas.profile import CandidateProfile, ProfileGetRequest, ProfileSaveRequest
from app.schemas.review import ReviewGetRequest, ReviewSaveRequest, ReviewState
from app.schemas.tasks import (
    TaskChangeRequest,
    TaskCreateRequest,
    TaskListRequest,
    TaskPage,
    TaskRecord,
)

DesktopRequest = Annotated[
    ListRequest
    | GetRequest
    | SaveRequest
    | DocumentListRequest
    | ProfileGetRequest
    | ProfileSaveRequest
    | DraftGetRequest
    | ReviewGetRequest
    | ReviewSaveRequest
    | TaskListRequest
    | TaskCreateRequest
    | TaskChangeRequest
    | ListingsListRequest
    | ListingGetRequest
    | ListingCreateRequest
    | ListingUpdateRequest
    | ListingTrackRequest
    | SearchListRequest
    | SearchSaveRequest
    | SearchDeleteRequest,
    Field(discriminator="action"),
]


DesktopResult = (
    ApplicationPage
    | ApplicationRecord
    | DocumentPage
    | CandidateProfile
    | DraftResponse
    | ReviewState
    | TaskRecord
    | TaskPage
    | ListingRecord
    | ListingPage
    | SearchPage
)


class Success(BaseModel):
    model_config = ConfigDict(extra="forbid")
    protocol_version: Literal[1] = 1
    ok: Literal[True] = True
    result: DesktopResult


class Failure(BaseModel):
    model_config = ConfigDict(extra="forbid")
    protocol_version: Literal[1] = 1
    ok: Literal[False] = False
    error: Literal[
        "invalid",
        "storage",
        "conflict",
        "not_found",
        "workspace_missing",
        "workspace_identity",
        "workspace_schema",
        "workspace_exists",
        "workspace_invalid",
        "workspace_unavailable",
        "workspace_backup",
    ]
