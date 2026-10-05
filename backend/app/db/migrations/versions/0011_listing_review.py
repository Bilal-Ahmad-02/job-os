"""Add the listing review workflow: shortlist flag, application link and saved searches."""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE job_listings ADD COLUMN shortlisted INTEGER NOT NULL DEFAULT 0 "
        "CHECK (shortlisted IN (0, 1))"
    )
    op.execute(
        "ALTER TABLE job_listings ADD COLUMN application_id VARCHAR(36) "
        "REFERENCES applications (id)"
    )
    # One listing per application; listings without an application are unconstrained.
    op.execute(
        "CREATE UNIQUE INDEX ix_job_listings_application ON job_listings (application_id) "
        "WHERE application_id IS NOT NULL"
    )
    op.create_table(
        "listing_searches",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("view", sa.String(12), nullable=False),
        sa.Column("created_at", sa.String(40), nullable=False),
        sa.CheckConstraint("length(name) BETWEEN 1 AND 80"),
        sa.CheckConstraint("length(query) <= 200"),
        sa.CheckConstraint("view IN ('incoming','shortlist','tracked','dismissed')"),
    )


def downgrade() -> None:
    raise RuntimeError("Restore a verified backup instead of removing listing review state.")
