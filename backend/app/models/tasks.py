"""Durable cooperative task journal; no private text or filesystem paths."""

from sqlalchemy import CheckConstraint, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.applications import Base

TASK_CHECKS = (
    "kind = 'document_extract'",
    "state IN ('queued','running','succeeded','failed','cancelled','interrupted')",
    "version >= 1",
    "total BETWEEN 1 AND 100 AND completed BETWEEN 0 AND total",
    "attempt BETWEEN 1 AND 3",
    "length(document_ids) <= 4000",
    "lease_until >= 0",
    "(state = 'running' AND lease_until > 0) OR (state != 'running' AND lease_until = 0)",
    "state != 'succeeded' OR completed = total",
    "error IN ('','document_invalid','document_timeout','source_no_text',"
    "'source_changed','source_missing','interrupted','storage')",
)


class BackgroundTask(Base):
    __tablename__ = "background_tasks"
    __table_args__ = tuple(CheckConstraint(rule) for rule in TASK_CHECKS)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    kind: Mapped[str] = mapped_column(String(30))
    state: Mapped[str] = mapped_column(String(20))
    version: Mapped[int] = mapped_column(Integer)
    document_ids: Mapped[str] = mapped_column(Text)
    total: Mapped[int] = mapped_column(Integer)
    completed: Mapped[int] = mapped_column(Integer)
    attempt: Mapped[int] = mapped_column(Integer)
    error: Mapped[str] = mapped_column(String(30))
    lease_until: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[str] = mapped_column(String(40))
    updated_at: Mapped[str] = mapped_column(String(40))
