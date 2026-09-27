"""Document transport exposes metadata only, never bytes or source paths."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

DocumentKind = Literal["cv", "certificate", "transcript"]


class DocumentListRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    action: Literal["documents_list"]


class DocumentSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: UUID
    filename: str = Field(min_length=1, max_length=255)
    kind: DocumentKind
    byte_size: int = Field(strict=True, ge=1, le=10485760)
    page_count: int = Field(strict=True, ge=1, le=100)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    imported_at: str = Field(max_length=40)
    evidence_status: Literal["source_only"] = "source_only"


class DocumentPage(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    items: list[DocumentSummary] = Field(max_length=100)
