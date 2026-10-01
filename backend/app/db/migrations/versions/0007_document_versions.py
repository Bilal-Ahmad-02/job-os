"""Link explicit revisions without changing any original document or evidence ID."""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "document_versions",
        sa.Column(
            "document_id", sa.String(36), sa.ForeignKey("source_documents.id"), primary_key=True
        ),
        sa.Column("family_id", sa.String(36), sa.ForeignKey("source_documents.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("previous_id", sa.String(36), sa.ForeignKey("source_documents.id"), unique=True),
        sa.UniqueConstraint("family_id", "version"),
        sa.CheckConstraint("version >= 1 AND version <= 100"),
        sa.CheckConstraint(
            "(version = 1 AND document_id = family_id AND previous_id IS NULL) OR "
            "(version > 1 AND document_id != family_id AND previous_id IS NOT NULL "
            "AND document_id != previous_id)"
        ),
    )
    op.execute(
        "INSERT INTO document_versions (document_id, family_id, version) "
        "SELECT id, id, 1 FROM source_documents"
    )


def downgrade() -> None:
    raise RuntimeError("Restore a verified backup instead of deleting version history.")
