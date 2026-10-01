"""Append-only document lineage; every version retains its own immutable source ID."""

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.applications import Base


class DocumentVersion(Base):
    __tablename__ = "document_versions"
    __table_args__ = (
        UniqueConstraint("family_id", "version"),
        CheckConstraint("version >= 1 AND version <= 100"),
        CheckConstraint(
            "(version = 1 AND document_id = family_id AND previous_id IS NULL) OR "
            "(version > 1 AND document_id != family_id AND previous_id IS NOT NULL "
            "AND document_id != previous_id)"
        ),
    )
    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("source_documents.id"), primary_key=True
    )
    family_id: Mapped[str] = mapped_column(String(36), ForeignKey("source_documents.id"))
    version: Mapped[int] = mapped_column(Integer)
    previous_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("source_documents.id"), unique=True
    )
