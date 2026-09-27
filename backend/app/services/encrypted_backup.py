"""Local restic adapter. Only encrypted repository files belong in a sync folder."""

import io
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
from pathlib import Path
from typing import BinaryIO

from app.services.backup_snapshot import (
    DATABASE,
    FILES,
    MANIFEST,
    MAX_DATABASE_BYTES,
    BackupError,
    SnapshotManifest,
    flush_file,
    snapshot_workspace,
    verify_snapshot,
)

TAG = "oracle-workspace-v1"
SNAPSHOT_ID = re.compile(r"^[a-f0-9]{64}$")


def private_directory(path: Path) -> Path:
    resolved = path.resolve()
    if not resolved.is_dir():
        raise BackupError("backup_staging_missing")
    for variable in ("OneDrive", "OneDriveConsumer", "OneDriveCommercial"):
        root = os.environ.get(variable)
        if root and resolved.is_relative_to(Path(root).resolve()):
            raise BackupError("backup_plaintext_sync_folder")
    return resolved


def validate_password(password: str) -> bytes:
    encoded = password.encode("utf-8")
    if not 20 <= len(password) <= 128 or len(encoded) > 512 or any(c in password for c in "\r\n\0"):
        raise BackupError("backup_password")
    return encoded + b"\n"


class ResticBackup:
    """Explicit trusted CLI paths, never parameters from the renderer or a model."""

    def __init__(self, executable: Path, repository: Path, password: str):
        self.executable = executable.resolve(strict=True)
        self.repository = repository.resolve()
        self._password = validate_password(password)
        if not self.executable.is_file():
            raise BackupError("backup_tool_missing")

    def _run(
        self,
        arguments: list[str],
        *,
        cwd: Path | None = None,
        sink: BinaryIO | None = None,
        limit: int = 2 * 1024 * 1024,
        timeout: float = 120,
    ) -> bytes:
        # Remove password-command and other inherited restic configuration. The
        # absolute repository is always a local filesystem path, never a remote URL.
        env = {
            key: value for key, value in os.environ.items() if not key.upper().startswith("RESTIC_")
        }
        flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        output = sink if sink is not None else io.BytesIO()
        expired = threading.Event()
        with subprocess.Popen(  # noqa: S603 -- trusted executable and fixed operations; no shell
            [
                str(self.executable),
                "--repo",
                str(self.repository),
                "--no-cache",
                "--json",
                *arguments,
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            cwd=cwd,
            env=env,
            creationflags=flags,
        ) as process:

            def expire() -> None:
                expired.set()
                process.kill()

            timer = threading.Timer(timeout, expire)
            timer.start()
            try:
                # Restic reads a single line from non-terminal stdin. Do not use
                # RESTIC_PASSWORD, password files, or --password-command.
                assert process.stdin is not None and process.stdout is not None  # noqa: S101
                process.stdin.write(self._password)
                process.stdin.close()
                size = 0
                while chunk := process.stdout.read(65536):
                    size += len(chunk)
                    if size > limit:
                        raise BackupError("backup_size")
                    output.write(chunk)
                code = process.wait(timeout=5)
                if expired.is_set():
                    raise BackupError("backup_timeout")
                if code != 0:
                    raise BackupError("backup_command_failed")
            finally:
                timer.cancel()
                if process.poll() is None:
                    process.kill()
                process.wait(timeout=5)
                timer.join(timeout=1)
        return output.getvalue() if isinstance(output, io.BytesIO) else b""

    def initialize(self) -> None:
        # An empty pre-existing folder might be an unavailable or partially synced
        # repository. Never treat it as permission to start a replacement history.
        if not self.repository.parent.is_dir():
            raise BackupError("backup_destination_missing")
        try:
            self.repository.mkdir(mode=0o700)
        except FileExistsError as exc:
            raise BackupError("backup_repository_exists") from exc
        self._run(["init", "--repository-version", "2"])

    def _require_repository(self) -> None:
        if not (self.repository / "config").is_file():
            raise BackupError("backup_destination_missing")

    def create(self, database: Path) -> str:
        self._require_repository()
        private_directory(database.parent)
        # Keep all plaintext staging beside the private database, never in OneDrive.
        if database.parent.resolve().is_relative_to(self.repository):
            raise BackupError("backup_path_overlap")
        if self.repository.is_relative_to(database.parent.resolve()):
            raise BackupError("backup_path_overlap")
        with tempfile.TemporaryDirectory(
            prefix=".oracle-backup-", dir=database.parent
        ) as temporary:
            payload = Path(temporary) / "payload"
            snapshot_workspace(database, payload)
            raw = self._run(["backup", "--host", "oracle", "--tag", TAG, *FILES], cwd=payload)
            summaries = [json.loads(line) for line in raw.splitlines() if line]
            snapshot_id = next(
                (
                    item.get("snapshot_id")
                    for item in summaries
                    if item.get("message_type") == "summary"
                ),
                None,
            )
            if not isinstance(snapshot_id, str) or not SNAPSHOT_ID.fullmatch(snapshot_id):
                raise BackupError("backup_protocol")
            # Read back and validate this exact snapshot before reporting success.
            restored = Path(temporary) / "verified"
            manifest = self._extract(snapshot_id, restored)
            if manifest != verify_snapshot(payload):
                raise BackupError("backup_checksum")
            return snapshot_id

    def snapshots(self) -> list[dict[str, str]]:
        self._require_repository()
        result = json.loads(self._run(["snapshots", "--tag", TAG]))
        if not isinstance(result, list):
            raise BackupError("backup_protocol")
        output = []
        for item in result:
            identifier = item.get("id")
            if not isinstance(identifier, str) or not SNAPSHOT_ID.fullmatch(identifier):
                raise BackupError("backup_protocol")
            output.append({"id": identifier, "time": str(item.get("time", ""))})
        return output

    def check(self) -> None:
        self._require_repository()
        self._run(["check", "--read-data"], timeout=300)

    def _extract(self, snapshot_id: str, target: Path) -> SnapshotManifest:
        if not SNAPSHOT_ID.fullmatch(snapshot_id):
            raise BackupError("backup_snapshot_id")
        target.mkdir(mode=0o700)
        for name in FILES:
            limit = MAX_DATABASE_BYTES if name == DATABASE else 4096 if name == MANIFEST else 37
            with (target / name).open("xb") as stream:
                # Dump fixed filenames only. No archive extraction or snapshot-
                # supplied paths, links, executables, or password hashes are restored.
                self._run(["dump", snapshot_id, f"/{name}"], sink=stream, limit=limit)
                stream.flush()
                os.fsync(stream.fileno())
        return verify_snapshot(target)

    def restore(self, snapshot_id: str, target: Path, private_staging: Path) -> SnapshotManifest:
        """Validate in private staging, then publish into a new directory only."""
        self._require_repository()
        target = target.resolve()
        if target.exists():
            raise BackupError("backup_target_exists")
        private_directory(target.parent)
        private_directory(private_staging)
        if target.is_relative_to(self.repository) or private_staging.resolve().is_relative_to(
            self.repository
        ):
            raise BackupError("backup_path_overlap")
        with tempfile.TemporaryDirectory(
            prefix=".oracle-restore-", dir=private_staging
        ) as temporary:
            payload = Path(temporary) / "payload"
            manifest = self._extract(snapshot_id, payload)
            # Exclusive creation also protects against a target appearing during validation.
            target.mkdir(mode=0o700)
            for name in FILES:
                with (
                    (payload / name).open("rb") as source,
                    (target / name).open("xb") as destination,
                ):
                    shutil.copyfileobj(source, destination)
                flush_file(target / name)
            verify_snapshot(target)
            return manifest
