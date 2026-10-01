"""One versioned candidate aggregate per private workspace."""

from sqlalchemy import CheckConstraint, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.applications import Base


class Profile(Base):
    __tablename__ = "candidate_profile"
    __table_args__ = (
        CheckConstraint("id = 1"),
        CheckConstraint("version >= 1"),
        CheckConstraint("length(CAST(data AS BLOB)) <= 262144"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    version: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[str] = mapped_column(String(40))
    data: Mapped[str] = mapped_column(Text)
