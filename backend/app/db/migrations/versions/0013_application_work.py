"""Add preparation notes, to-do items and document links to applications.

Existing rows keep all values.
"""

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE applications ADD COLUMN preparation TEXT NOT NULL DEFAULT '' "
        "CHECK (length(preparation) <= 10000)"
    )
    op.execute(
        "CREATE TABLE application_todos ("
        "application_id VARCHAR(36) NOT NULL REFERENCES applications (id), "
        "position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 29), "
        "title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200), "
        "due_date VARCHAR(10) NOT NULL CHECK (length(due_date) IN (0, 10)), "
        "done INTEGER NOT NULL CHECK (done IN (0, 1)), "
        "PRIMARY KEY (application_id, position))"
    )
    op.execute(
        "CREATE TABLE application_documents ("
        "application_id VARCHAR(36) NOT NULL REFERENCES applications (id), "
        "position INTEGER NOT NULL CHECK (position BETWEEN 0 AND 9), "
        "document_id VARCHAR(36) NOT NULL REFERENCES source_documents (id), "
        "PRIMARY KEY (application_id, position), "
        "UNIQUE (application_id, document_id))"
    )


def downgrade() -> None:
    raise RuntimeError("Restore a verified backup instead of removing application work items.")
