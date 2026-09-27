"""Preserve original personal PDFs with immutable provenance."""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "source_documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("sha256", sa.String(64), nullable=False, unique=True),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(24), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=False),
        sa.Column("imported_at", sa.String(40), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.CheckConstraint("kind IN ('cv', 'certificate', 'transcript')"),
        sa.CheckConstraint("byte_size > 0 AND byte_size <= 10485760"),
        sa.CheckConstraint("page_count > 0 AND page_count <= 100"),
        sa.CheckConstraint("length(content) = byte_size"),
    )


def downgrade() -> None:
    raise RuntimeError("Restore a verified backup instead of deleting source documents.")
