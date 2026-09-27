"""Initial application history and spreadsheet provenance.

Revision ID: 0001
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        *[
            sa.Column(name, sa.Text(), nullable=False)
            for name in ("title", "company", "website", "source", "learning", "description")
        ],
    )
    op.create_table(
        "applications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("job_id", sa.String(36), sa.ForeignKey("jobs.id"), nullable=False, unique=True),
        *[
            sa.Column(name, sa.Text(), nullable=False)
            for name in (
                "resume_sent",
                "how_sent",
                "references_sent",
                "status_notes",
                "interview",
                "follow_up",
                "notes",
            )
        ],
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.String(40), nullable=False),
    )
    op.create_table(
        "import_batches",
        sa.Column("sha256", sa.String(64), primary_key=True),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("imported_at", sa.String(40), nullable=False),
        sa.Column("row_count", sa.Integer(), nullable=False),
    )
    op.create_table(
        "imported_rows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "batch_id", sa.String(64), sa.ForeignKey("import_batches.sha256"), nullable=False
        ),
        sa.Column(
            "application_id",
            sa.String(36),
            sa.ForeignKey("applications.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("sheet", sa.Text(), nullable=False),
        sa.Column("row_number", sa.Integer(), nullable=False),
        sa.Column("original", sa.JSON(), nullable=False),
        sa.Column("links", sa.JSON(), nullable=False),
        sa.UniqueConstraint("batch_id", "sheet", "row_number"),
    )


def downgrade() -> None:
    raise RuntimeError("Destructive downgrade is not supported; restore a verified backup.")
