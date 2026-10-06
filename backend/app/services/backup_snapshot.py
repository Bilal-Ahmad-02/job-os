"""Consistent, narrowly scoped workspace snapshots; no encryption or cloud access here."""

import hashlib
import os
import sqlite3
import time
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.db.store import (
    SCHEMA_VERSION,
    WorkspaceError,
    existing_engine,
    open_store,
    read_identity,
    validate_identity,
)
from app.db.workspace import validate_contents

DATABASE = "oracle.sqlite3"
IDENTITY = "oracle.workspace-id"
MANIFEST = "manifest.json"
FILES = (DATABASE, IDENTITY, MANIFEST)
MAX_DATABASE_BYTES = 256 * 1024 * 1024


class BackupError(Exception):
    """Stable public code with no paths, record contents, or credentials."""


class FileDigest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    size: int = Field(ge=1, le=MAX_DATABASE_BYTES)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class SnapshotManifest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    format: Literal[1]
    schema_revision: Literal[
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
        "0013",
    ]
    workspace_id: UUID
    created_at: datetime
    files: dict[str, FileDigest]


def digest(path: Path) -> FileDigest:
    with path.open("rb") as stream:
        value = hashlib.file_digest(stream, "sha256").hexdigest()
    return FileDigest(size=path.stat().st_size, sha256=value)


def flush_file(path: Path) -> None:
    with path.open("r+b") as stream:
        os.fsync(stream.fileno())


def verify_snapshot(directory: Path) -> SnapshotManifest:
    """Only the three known regular files are accepted. No archive paths are trusted."""
    try:
        entries = list(directory.iterdir())
        if {entry.name for entry in entries} != set(FILES):
            raise BackupError("backup_manifest")
        if any(entry.is_symlink() or not entry.is_file() for entry in entries):
            raise BackupError("backup_manifest")
        if (directory / MANIFEST).stat().st_size > 4096:
            raise BackupError("backup_manifest")
        manifest = SnapshotManifest.model_validate_json((directory / MANIFEST).read_bytes())
        if set(manifest.files) != {DATABASE, IDENTITY} or manifest.created_at.tzinfo is None:
            raise BackupError("backup_manifest")
        for name in (DATABASE, IDENTITY):
            maximum = MAX_DATABASE_BYTES if name == DATABASE else 37
            if not 0 < (directory / name).stat().st_size <= maximum:
                raise BackupError("backup_size")
            if digest(directory / name) != manifest.files[name]:
                raise BackupError("backup_checksum")
        database = directory / DATABASE
        if read_identity(database) != str(manifest.workspace_id):
            raise BackupError("backup_identity")
        engine = existing_engine(database)
        try:
            with engine.connect() as connection:
                validate_identity(connection, str(manifest.workspace_id), manifest.schema_revision)
                validate_contents(connection, manifest.schema_revision)
                if connection.exec_driver_sql("PRAGMA integrity_check").scalars().all() != ["ok"]:
                    raise BackupError("backup_integrity")
        finally:
            engine.dispose()
        return manifest
    except BackupError:
        raise
    except (OSError, ValueError, ValidationError, WorkspaceError, sqlite3.Error) as exc:
        raise BackupError("backup_invalid") from exc


def snapshot_workspace(database: Path, target: Path) -> SnapshotManifest:
    """Snapshot under a short writer reservation. Target must be a new private directory."""
    if not database.is_file():
        raise BackupError("backup_source_missing")
    if database.stat().st_size > MAX_DATABASE_BYTES:
        raise BackupError("backup_size")
    engine = open_store(database)
    try:
        target.mkdir(mode=0o700)
        destination = target / DATABASE
        with destination.open("xb"):
            pass
        deadline = time.monotonic() + 10

        def progress(_status: int, _remaining: int, total: int) -> None:
            if time.monotonic() > deadline:
                raise BackupError("backup_timeout")
            if total * page_size > MAX_DATABASE_BYTES:
                raise BackupError("backup_size")

        with engine.connect().execution_options(oracle_write=True) as guard:
            with guard.begin():
                validate_contents(guard, SCHEMA_VERSION)
                identity = read_identity(database)
                with closing(
                    sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)
                ) as source:
                    page_size = source.execute("PRAGMA page_size").fetchone()[0]
                    with closing(sqlite3.connect(destination)) as copy:
                        source.backup(copy, pages=256, progress=progress, sleep=0.05)
        (target / IDENTITY).write_bytes((identity + "\n").encode("ascii"))
        manifest = SnapshotManifest(
            format=1,
            schema_revision=SCHEMA_VERSION,
            workspace_id=UUID(identity),
            created_at=datetime.now(UTC),
            files={name: digest(target / name) for name in (DATABASE, IDENTITY)},
        )
        (target / MANIFEST).write_text(manifest.model_dump_json(indent=2), encoding="utf-8")
        for name in FILES:
            flush_file(target / name)
        return verify_snapshot(target)
    finally:
        engine.dispose()
