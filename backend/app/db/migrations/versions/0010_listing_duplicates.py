"""Add a duplicate-detection key and an owner-set closed flag to job listings.

Existing listings keep every stored value. Their text key is derived from the unchanged original.
"""

import sqlalchemy as sa
from alembic import op

from app.services.listing_normalizer import KEYS_VERSION, text_key

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE job_listings ADD COLUMN text_key VARCHAR(64) NOT NULL DEFAULT '' "
        "CHECK (length(text_key) IN (0, 64))"
    )
    op.execute(
        "ALTER TABLE job_listings ADD COLUMN keys_version INTEGER NOT NULL DEFAULT 0 "
        "CHECK (keys_version >= 0)"
    )
    op.execute(
        "ALTER TABLE job_listings ADD COLUMN closed INTEGER NOT NULL DEFAULT 0 "
        "CHECK (closed IN (0, 1))"
    )
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, original_text FROM job_listings")).all()
    for identity, original in rows:
        connection.execute(
            sa.text(
                "UPDATE job_listings SET text_key = :key, keys_version = :version WHERE id = :id"
            ),
            {"key": text_key(original), "version": KEYS_VERSION, "id": identity},
        )


def downgrade() -> None:
    raise RuntimeError("Restore a verified backup instead of removing listing review state.")
