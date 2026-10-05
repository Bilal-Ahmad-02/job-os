"""Add owner-supplied job listings with their unchanged pasted originals."""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_listings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("origin", sa.String(10), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("company", sa.Text(), nullable=False),
        sa.Column("location", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("original_text", sa.Text(), nullable=False),
        sa.Column("original_sha256", sa.String(64), nullable=False),
        sa.Column("collected_at", sa.String(40), nullable=False),
        sa.Column("archived", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.String(40), nullable=False),
        sa.CheckConstraint("origin IN ('pasted','manual')"),
        sa.CheckConstraint("(origin = 'pasted') = (length(original_text) > 0)"),
        sa.CheckConstraint("length(original_text) <= 50000"),
        sa.CheckConstraint("length(original_sha256) = 64"),
        sa.CheckConstraint("archived IN (0,1)"),
        sa.CheckConstraint("version >= 1"),
    )


def downgrade() -> None:
    raise RuntimeError("Restore a verified backup instead of deleting collected listings.")
