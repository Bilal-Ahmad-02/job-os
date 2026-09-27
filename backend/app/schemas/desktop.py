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

DesktopRequest = Annotated[
    ListRequest | GetRequest | SaveRequest | DocumentListRequest, Field(discriminator="action")
]


class Success(BaseModel):
    model_config = ConfigDict(extra="forbid")
    protocol_version: Literal[1] = 1
    ok: Literal[True] = True
    result: ApplicationPage | ApplicationRecord | DocumentPage


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
