"""Add an initially empty candidate profile store without inferring personal facts."""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "candidate_profile",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.String(40), nullable=False),
        sa.Column("data", sa.Text(), nullable=False),
        sa.CheckConstraint("id = 1"),
        sa.CheckConstraint("version >= 1"),
        sa.CheckConstraint("length(CAST(data AS BLOB)) <= 262144"),
    )


def downgrade() -> None:
    raise RuntimeError("Restore a verified backup instead of deleting candidate data.")
