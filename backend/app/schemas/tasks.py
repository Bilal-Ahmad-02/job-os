"""Only source-text extraction is admitted; no arbitrary job names or commands."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas.profile import Contract

TaskState = Literal["queued", "running", "succeeded", "failed", "cancelled", "interrupted"]
TaskFailure = Literal[
    "",
    "document_invalid",
    "document_timeout",
    "source_no_text",
    "source_changed",
    "source_missing",
    "interrupted",
    "storage",
]


class TaskListRequest(Contract):
    action: Literal["tasks_list"]


class TaskCreateRequest(Contract):
    action: Literal["task_create"]
    id: Annotated[UUID, Field(strict=False)]
    document_ids: list[Annotated[UUID, Field(strict=False)]] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def unique_documents(self) -> "TaskCreateRequest":
        if len(set(self.document_ids)) != len(self.document_ids):
            raise ValueError("Duplicate source")
        return self


class TaskChangeRequest(Contract):
    action: Literal["task_advance", "task_cancel", "task_retry"]
    id: Annotated[UUID, Field(strict=False)]
    version: int = Field(ge=1)


class TaskRecord(Contract):
    id: Annotated[UUID, Field(strict=False)]
    kind: Literal["document_extract"]
    state: TaskState
    version: int = Field(ge=1)
    total: int = Field(ge=1, le=100)
    completed: int = Field(ge=0, le=100)
    attempt: int = Field(ge=1, le=3)
    error: TaskFailure
    document_ids: list[Annotated[UUID, Field(strict=False)]] = Field(min_length=1, max_length=100)
    created_at: str = Field(max_length=40)
    updated_at: str = Field(max_length=40)

    @model_validator(mode="after")
    def consistent(self) -> "TaskRecord":
        if self.total != len(self.document_ids) or self.completed > self.total:
            raise ValueError("Invalid progress")
        if len(set(self.document_ids)) != self.total:
            raise ValueError("Duplicate source")
        if self.state == "succeeded" and self.completed != self.total:
            raise ValueError("Incomplete success")
        return self


class TaskPage(Contract):
    items: list[TaskRecord] = Field(max_length=100)
