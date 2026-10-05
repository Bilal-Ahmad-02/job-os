"""Add owner-entered deadline and follow-up dates to applications. Existing rows keep all values."""

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for column in ("deadline_date", "follow_up_date"):
        op.execute(
            f"ALTER TABLE applications ADD COLUMN {column} VARCHAR(10) NOT NULL DEFAULT '' "
            f"CHECK (length({column}) IN (0, 10))"
        )


def downgrade() -> None:
    raise RuntimeError("Restore a verified backup instead of removing application dates.")
