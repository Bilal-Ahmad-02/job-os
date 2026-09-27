"""Bind an Oracle database to its local workspace identity."""

from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    table = op.create_table(
        "workspace_metadata",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("workspace_id", sa.String(36), nullable=False, unique=True),
        sa.CheckConstraint("id = 1"),
    )
    op.execute(table.insert().values(id=1, workspace_id=str(uuid4())))
    op.execute("PRAGMA application_id = 1330791244")  # ASCII ORCL


def downgrade() -> None:
    raise RuntimeError("Restore a verified backup instead of removing workspace identity.")
