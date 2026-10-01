"""Add a bounded journal for explicitly requested document extraction tasks."""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "background_tasks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("state", sa.String(20), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("document_ids", sa.Text(), nullable=False),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("completed", sa.Integer(), nullable=False),
        sa.Column("attempt", sa.Integer(), nullable=False),
        sa.Column("error", sa.String(30), nullable=False),
        sa.Column("lease_until", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.String(40), nullable=False),
        sa.Column("updated_at", sa.String(40), nullable=False),
        sa.CheckConstraint("kind = 'document_extract'"),
        sa.CheckConstraint(
            "state IN ('queued','running','succeeded','failed','cancelled','interrupted')"
        ),
        sa.CheckConstraint("version >= 1"),
        sa.CheckConstraint("total BETWEEN 1 AND 100 AND completed BETWEEN 0 AND total"),
        sa.CheckConstraint("attempt BETWEEN 1 AND 3"),
        sa.CheckConstraint("length(document_ids) <= 4000"),
        sa.CheckConstraint("lease_until >= 0"),
        sa.CheckConstraint(
            "(state = 'running' AND lease_until > 0) OR (state != 'running' AND lease_until = 0)"
        ),
        sa.CheckConstraint("state != 'succeeded' OR completed = total"),
        sa.CheckConstraint(
            "error IN ('','document_invalid','document_timeout','source_no_text',"
            "'source_changed','source_missing','interrupted','storage')"
        ),
    )


def downgrade() -> None:
    raise RuntimeError("Restore a verified backup instead of deleting task history.")
