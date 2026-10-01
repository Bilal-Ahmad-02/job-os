"""Persist explicit review decisions separately from the source draft."""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "profile_review",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("decisions", sa.Text(), nullable=False),
        sa.CheckConstraint("id = 1"),
        sa.CheckConstraint("version >= 1"),
        sa.CheckConstraint("length(CAST(decisions AS BLOB)) <= 131072"),
    )


def downgrade() -> None:
    raise RuntimeError("Restore a verified backup instead of deleting review decisions.")
