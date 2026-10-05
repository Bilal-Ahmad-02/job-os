"""Jobs, their application records, and immutable import provenance."""

from sqlalchemy import JSON, CheckConstraint, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class WorkspaceMetadata(Base):
    __tablename__ = "workspace_metadata"
    __table_args__ = (CheckConstraint("id = 1"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    workspace_id: Mapped[str] = mapped_column(String(36), unique=True)


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    company: Mapped[str] = mapped_column(Text)
    website: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(Text)
    learning: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"), unique=True)
    resume_sent: Mapped[str] = mapped_column(Text)
    how_sent: Mapped[str] = mapped_column(Text)
    references_sent: Mapped[str] = mapped_column(Text)
    status_notes: Mapped[str] = mapped_column(Text)
    interview: Mapped[str] = mapped_column(Text)
    follow_up: Mapped[str] = mapped_column(Text)
    notes: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32))
    version: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[str] = mapped_column(String(40))
    # Owner-entered ISO dates or empty. Oracle never sets them and nothing fires on them.
    deadline_date: Mapped[str] = mapped_column(String(10), default="")
    follow_up_date: Mapped[str] = mapped_column(String(10), default="")


class ImportBatch(Base):
    __tablename__ = "import_batches"
    sha256: Mapped[str] = mapped_column(String(64), primary_key=True)
    filename: Mapped[str] = mapped_column(Text)
    imported_at: Mapped[str] = mapped_column(String(40))
    row_count: Mapped[int] = mapped_column(Integer)


class ImportedRow(Base):
    __tablename__ = "imported_rows"
    __table_args__ = (UniqueConstraint("batch_id", "sheet", "row_number"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[str] = mapped_column(ForeignKey("import_batches.sha256"))
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id"), unique=True)
    sheet: Mapped[str] = mapped_column(Text)
    row_number: Mapped[int] = mapped_column(Integer)
    original: Mapped[dict] = mapped_column(JSON)
    links: Mapped[dict] = mapped_column(JSON)
