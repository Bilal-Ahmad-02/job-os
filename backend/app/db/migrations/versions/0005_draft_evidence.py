"""Keep extracted page text and unreviewed draft data separate from candidate assertions."""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_text",
        sa.Column(
            "document_id", sa.String(36), sa.ForeignKey("source_documents.id"), primary_key=True
        ),
        sa.Column("source_sha256", sa.String(64), nullable=False),
        sa.Column("extractor", sa.String(100), nullable=False),
        sa.Column("created_at", sa.String(40), nullable=False),
        sa.Column("pages", sa.Text(), nullable=False),
        sa.CheckConstraint("length(CAST(pages AS BLOB)) <= 528384"),
    )
    op.create_table(
        "profile_draft",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.String(40), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.CheckConstraint("id = 1"),
        sa.CheckConstraint("length(CAST(payload AS BLOB)) <= 524288"),
    )


def downgrade() -> None:
    raise RuntimeError("Restore a verified backup instead of deleting draft evidence.")
