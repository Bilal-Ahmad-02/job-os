"""Latest owner decisions for the immutable source draft."""

from sqlalchemy import CheckConstraint, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.applications import Base


class ProfileReview(Base):
    __tablename__ = "profile_review"
    __table_args__ = (
        CheckConstraint("id = 1"),
        CheckConstraint("version >= 1"),
        CheckConstraint("length(CAST(decisions AS BLOB)) <= 131072"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    version: Mapped[int] = mapped_column(Integer)
    decisions: Mapped[str] = mapped_column(Text)
