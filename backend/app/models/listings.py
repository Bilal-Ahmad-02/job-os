"""Owner-supplied job listings. The pasted original and collection time never change."""

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.applications import Base

LISTING_CHECKS = (
    "origin IN ('pasted','manual')",
    "(origin = 'pasted') = (length(original_text) > 0)",
    "length(original_text) <= 50000",
    "length(original_sha256) = 64",
    "archived IN (0,1)",
    "version >= 1",
    "length(text_key) IN (0, 64)",
    "keys_version >= 0",
    "closed IN (0, 1)",
    "shortlisted IN (0, 1)",
)


class JobListing(Base):
    __tablename__ = "job_listings"
    __table_args__ = tuple(CheckConstraint(rule) for rule in LISTING_CHECKS)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    origin: Mapped[str] = mapped_column(String(10))
    title: Mapped[str] = mapped_column(Text)
    company: Mapped[str] = mapped_column(Text)
    location: Mapped[str] = mapped_column(Text)
    url: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(Text)
    notes: Mapped[str] = mapped_column(Text)
    original_text: Mapped[str] = mapped_column(Text)
    original_sha256: Mapped[str] = mapped_column(String(64))
    collected_at: Mapped[str] = mapped_column(String(40))
    archived: Mapped[int] = mapped_column(Integer)
    version: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[str] = mapped_column(String(40))
    # Derived from the unchanged original for duplicate detection; never owner-entered.
    text_key: Mapped[str] = mapped_column(String(64), default="")
    keys_version: Mapped[int] = mapped_column(Integer, default=0)
    # Owner's statement that the role is no longer open. Oracle never sets it.
    closed: Mapped[int] = mapped_column(Integer, default=0)
    # Owner review state. Dismissal is the existing archived flag.
    shortlisted: Mapped[int] = mapped_column(Integer, default=0)
    # Set once when the owner starts an application from this listing.
    application_id: Mapped[str | None] = mapped_column(ForeignKey("applications.id"), default=None)


class ListingSearch(Base):
    """A filter the owner named. It stores no results and runs nothing by itself."""

    __tablename__ = "listing_searches"
    __table_args__ = (
        CheckConstraint("length(name) BETWEEN 1 AND 80"),
        CheckConstraint("length(query) <= 200"),
        CheckConstraint("view IN ('incoming','shortlist','tracked','dismissed')"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    query: Mapped[str] = mapped_column(Text)
    view: Mapped[str] = mapped_column(String(12))
    created_at: Mapped[str] = mapped_column(String(40))
