"""Open existing workspaces without creating files or running migrations."""

import sqlite3
from pathlib import Path
from uuid import UUID

from sqlalchemy import Connection, Engine, create_engine, event, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.pool import NullPool

SCHEMA_VERSION = "0013"
SUPPORTED_REVISIONS = (
    "0001",
    "0002",
    "0003",
    "0004",
    "0005",
    "0006",
    "0007",
    "0008",
    "0009",
    "0010",
    "0011",
    "0012",
    SCHEMA_VERSION,
)
APPLICATION_ID = 0x4F52434C


class WorkspaceError(Exception):
    """A stable public code; never includes a path or database contents."""


def identity_path(path: Path) -> Path:
    return path.with_suffix(".workspace-id")


def read_identity(path: Path) -> str:
    try:
        with identity_path(path).open("rb") as stream:
            raw = stream.read(38)
        if len(raw) != 37 or not raw.endswith(b"\n"):
            raise ValueError("Invalid identity")
        value = raw.decode("ascii").strip()
        if str(UUID(value)) != value:
            raise ValueError("Invalid identity")
        return value
    except (OSError, ValueError, UnicodeError) as exc:
        raise WorkspaceError("workspace_identity") from exc


def existing_engine(path: Path) -> Engine:
    # No-create is enforced by SQLite itself, including races after a path check.
    uri = path.resolve().as_uri() + "?mode=rw"

    def connect() -> sqlite3.Connection:
        try:
            return sqlite3.connect(uri, uri=True, timeout=3, isolation_level=None)
        except sqlite3.Error as exc:
            raise WorkspaceError("workspace_unavailable") from exc

    engine = create_engine("sqlite://", creator=connect, poolclass=NullPool)

    @event.listens_for(engine, "connect")
    def configure(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")

    @event.listens_for(engine, "begin")
    def begin(connection):
        write = connection.get_execution_options().get("oracle_write", False)
        connection.exec_driver_sql("BEGIN IMMEDIATE" if write else "BEGIN")

    return engine


def check_revision(connection: Connection) -> str:
    versions = connection.execute(text("SELECT version_num FROM alembic_version")).scalars().all()
    if len(versions) != 1 or versions[0] not in SUPPORTED_REVISIONS:
        raise WorkspaceError("workspace_schema")
    return versions[0]


def validate_identity(
    connection: Connection, expected: str, revision: str = SCHEMA_VERSION
) -> None:
    if revision not in SUPPORTED_REVISIONS[1:] or check_revision(connection) != revision:
        raise WorkspaceError("workspace_schema")
    if connection.exec_driver_sql("PRAGMA application_id").scalar() != APPLICATION_ID:
        raise WorkspaceError("workspace_identity")
    records = connection.execute(text("SELECT id, workspace_id FROM workspace_metadata")).all()
    if records != [(1, expected)]:
        raise WorkspaceError("workspace_identity")


def open_store(path: Path) -> Engine:
    if not path.is_file():
        raise WorkspaceError("workspace_missing")
    expected = read_identity(path)
    engine = existing_engine(path)

    @event.listens_for(engine, "begin")
    def verify(connection):
        # Recheck even if the database was replaced after the engine was made.
        try:
            validate_identity(connection, expected)
        except DBAPIError as exc:
            raise WorkspaceError("workspace_invalid") from exc

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except DBAPIError as exc:
        engine.dispose()
        raise WorkspaceError("workspace_invalid") from exc
    except Exception:
        engine.dispose()
        raise
    return engine
