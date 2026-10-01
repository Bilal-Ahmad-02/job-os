"""Private immutable extraction and a separate review draft."""

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.applications import Base


class DocumentText(Base):
    __tablename__ = "document_text"
    __table_args__ = (CheckConstraint("length(CAST(pages AS BLOB)) <= 528384"),)
    document_id: Mapped[str] = mapped_column(ForeignKey("source_documents.id"), primary_key=True)
    source_sha256: Mapped[str] = mapped_column(String(64))
    extractor: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[str] = mapped_column(String(40))
    pages: Mapped[str] = mapped_column(Text)


class ProfileDraft(Base):
    __tablename__ = "profile_draft"
    __table_args__ = (
        CheckConstraint("id = 1"),
        CheckConstraint("length(CAST(payload AS BLOB)) <= 524288"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[str] = mapped_column(String(40))
    payload: Mapped[str] = mapped_column(Text)
