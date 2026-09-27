"""Explicit first-run creation and coordinated startup maintenance."""

import os
import sqlite3
import tempfile
import time
from contextlib import closing
from pathlib import Path
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, Engine, inspect, select, text
from sqlalchemy.exc import DBAPIError

from app.db.store import (
    SCHEMA_VERSION,
    WorkspaceError,
    check_revision,
    existing_engine,
    identity_path,
    open_store,
    read_identity,
    validate_identity,
)
from app.models.applications import Base
from app.models.documents import SourceDocument  # noqa: F401 -- register current schema metadata


def migrate(connection: Connection) -> None:
    cfg = Config()
    cfg.set_main_option(
        "script_location", str(Path(__file__).parent / "migrations").replace("%", "%%")
    )
    cfg.attributes["connection"] = connection
    command.upgrade(cfg, "head")


def publish_identity(path: Path, identity: str) -> None:
    # Publish a complete flushed marker without replacing an existing identity.
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
        temporary = Path(stream.name)
        stream.write((identity + "\n").encode("ascii"))
        stream.flush()
        os.fsync(stream.fileno())
    try:
        try:
            os.link(temporary, identity_path(path))
        except FileExistsError:
            if read_identity(path) != identity:
                raise WorkspaceError("workspace_identity") from None
    finally:
        temporary.unlink()


def initialize_workspace(path: Path) -> Engine:
    if identity_path(path).exists() or path.exists():
        raise WorkspaceError("workspace_exists")
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open("xb"):
            pass
    except FileExistsError as exc:
        raise WorkspaceError("workspace_exists") from exc
    # Interrupted initialization leaves evidence; never delete/recreate on retry.
    engine = existing_engine(path)
    try:
        with engine.connect().execution_options(oracle_write=True) as connection:
            with connection.begin():
                migrate(connection)
                identity = connection.execute(
                    text("SELECT workspace_id FROM workspace_metadata")
                ).scalar_one()
        publish_identity(path, identity)
    finally:
        engine.dispose()
    return open_store(path)


def validate_contents(connection: Connection, revision: str) -> None:
    if connection.exec_driver_sql("PRAGMA quick_check").scalars().all() != ["ok"]:
        raise WorkspaceError("workspace_invalid")
    if connection.exec_driver_sql("PRAGMA foreign_key_check").first() is not None:
        raise WorkspaceError("workspace_invalid")
    tables = set(inspect(connection).get_table_names())
    expected = {"alembic_version", *Base.metadata.tables}
    if revision == "0001":
        expected.remove("workspace_metadata")
    if revision in ("0001", "0002"):
        expected.remove("source_documents")
    if not expected.issubset(tables):
        raise WorkspaceError("workspace_schema")
    for table in Base.metadata.sorted_tables:
        if table.name in expected:
            connection.execute(select(table).limit(0))


def migration_snapshot(path: Path) -> None:
    directory = path.parent / "migration-backups"
    directory.mkdir(exist_ok=True)
    target = directory / f"before-{SCHEMA_VERSION}-{uuid4()}.sqlite3"
    partial = target.with_suffix(".sqlite3.partial")
    deadline = time.monotonic() + 8

    def progress(_status: int, _remaining: int, _total: int) -> None:
        if time.monotonic() > deadline:
            raise WorkspaceError("workspace_backup")

    with partial.open("xb"):
        pass
    with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True)) as source:
        with closing(sqlite3.connect(partial)) as destination:
            source.backup(destination, pages=256, progress=progress, sleep=0.05)
            if destination.execute("PRAGMA integrity_check").fetchall() != [("ok",)]:
                raise WorkspaceError("workspace_backup")
    with partial.open("r+b") as stream:
        os.fsync(stream.fileno())
    partial.rename(target)


def prepare_workspace(path: Path) -> None:
    if not path.is_file():
        raise WorkspaceError("workspace_missing")
    engine = existing_engine(path)
    identity = None
    try:
        # Coordinate maintenance with writes across app instances. Reads do not
        # take this writer reservation during ordinary operation.
        with engine.connect().execution_options(oracle_write=True) as connection:
            with connection.begin():
                revision = check_revision(connection)
                validate_contents(connection, revision)
                if revision != SCHEMA_VERSION:
                    if revision == "0001" and identity_path(path).exists():
                        raise WorkspaceError("workspace_identity")
                    if revision == "0002":
                        validate_identity(connection, read_identity(path), revision)
                    # A separate reader snapshots before DDL while our reserved
                    # writer lock excludes mutations by other connections.
                    migration_snapshot(path)
                    migrate(connection)
                    identity = connection.execute(
                        text("SELECT workspace_id FROM workspace_metadata")
                    ).scalar_one()
                else:
                    validate_identity(connection, read_identity(path))
        if identity is not None:
            publish_identity(path, identity)
    except DBAPIError as exc:
        raise WorkspaceError("workspace_invalid") from exc
    finally:
        engine.dispose()
