"""Migrations run only on the connection supplied by the local store."""

from alembic import context

from app.models.applications import Base

context.configure(
    connection=context.config.attributes["connection"],
    target_metadata=Base.metadata,
    transactional_ddl=True,
)
with context.begin_transaction():
    context.run_migrations()
