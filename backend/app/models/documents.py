"""Immutable personal source documents. Originals stay inside the private workspace."""

from sqlalchemy import CheckConstraint, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.applications import Base


class SourceDocument(Base):
    __tablename__ = "source_documents"
    __table_args__ = (
        CheckConstraint("kind IN ('cv', 'certificate', 'transcript')"),
        CheckConstraint("byte_size > 0 AND byte_size <= 10485760"),
        CheckConstraint("page_count > 0 AND page_count <= 100"),
        CheckConstraint("length(content) = byte_size"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    sha256: Mapped[str] = mapped_column(String(64), unique=True)
    filename: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(24))
    byte_size: Mapped[int] = mapped_column(Integer)
    page_count: Mapped[int] = mapped_column(Integer)
    imported_at: Mapped[str] = mapped_column(String(40))
    content: Mapped[bytes] = mapped_column(LargeBinary, deferred=True)
