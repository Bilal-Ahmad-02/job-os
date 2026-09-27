"""Immutable local document ingestion and metadata-only queries."""

import hashlib
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.models.documents import SourceDocument
from app.pdf_probe import MAX_PDF
from app.schemas.documents import DocumentKind, DocumentPage, DocumentSummary


class DocumentError(Exception):
    """Stable public code, no private file contents or paths."""


@dataclass(frozen=True)
class PreparedDocument:
    filename: str
    kind: DocumentKind
    content: bytes
    sha256: str
    page_count: int


def read_document(kind: DocumentKind, path: Path) -> PreparedDocument:
    if kind not in ("cv", "certificate", "transcript") or not 1 <= len(path.name) <= 255:
        raise DocumentError("document_invalid")
    with path.open("rb") as stream:
        raw = stream.read(MAX_PDF + 1)
    if not raw.startswith(b"%PDF-") or len(raw) > MAX_PDF:
        raise DocumentError("document_invalid")
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    with subprocess.Popen(  # noqa: S603 -- fixed module/interpreter; PDF bytes only on stdin
        [sys.executable, "-I", "-m", "app.pdf_probe"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        creationflags=flags,
    ) as process:
        try:
            output, _ = process.communicate(raw, timeout=15)
        except subprocess.TimeoutExpired as exc:
            if os.name == "nt":
                try:
                    subprocess.run(  # noqa: S603 -- fixed Windows utility, numeric process ID
                        [
                            str(Path(os.environ["SystemRoot"]) / "System32" / "taskkill.exe"),
                            "/PID",
                            str(process.pid),
                            "/T",
                            "/F",
                        ],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=flags,
                        timeout=5,
                        check=False,
                    )
                finally:
                    process.kill()
            else:
                process.kill()
            process.communicate(timeout=5)
            raise DocumentError("document_timeout") from exc
    if process.returncode != 0 or len(output) > 1024:
        raise DocumentError("document_invalid")
    result = json.loads(output)
    count = result.get("pages")
    if type(count) is not int or not 1 <= count <= 100:
        raise DocumentError("document_invalid")
    return PreparedDocument(path.name, kind, raw, hashlib.sha256(raw).hexdigest(), count)


def import_documents(engine: Engine, documents: list[PreparedDocument]) -> list[str]:
    if not 1 <= len(documents) <= 10:
        raise DocumentError("document_batch_limit")
    identities = []
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        for document in documents:
            if (
                not 0 < len(document.content) <= MAX_PDF
                or hashlib.sha256(document.content).hexdigest() != document.sha256
            ):
                raise DocumentError("document_invalid")
            existing = session.scalar(
                select(SourceDocument).where(SourceDocument.sha256 == document.sha256)
            )
            if existing is not None:
                if existing.kind != document.kind:
                    raise DocumentError("document_kind_conflict")
                identities.append(existing.id)
                continue
            count, size = session.execute(
                select(
                    func.count(), func.coalesce(func.sum(SourceDocument.byte_size), 0)
                ).select_from(SourceDocument)
            ).one()
            if count >= 100 or size + len(document.content) > 100 * 1024 * 1024:
                raise DocumentError("document_storage_limit")
            record = SourceDocument(
                id=str(uuid4()),
                sha256=document.sha256,
                filename=document.filename,
                kind=document.kind,
                byte_size=len(document.content),
                page_count=document.page_count,
                imported_at=datetime.now(UTC).isoformat(),
                content=document.content,
            )
            session.add(record)
            session.flush()
            identities.append(record.id)
    return identities


def list_documents(engine: Engine) -> DocumentPage:
    with Session(engine) as session, session.begin():
        rows = session.execute(
            select(
                SourceDocument.id,
                SourceDocument.filename,
                SourceDocument.kind,
                SourceDocument.byte_size,
                SourceDocument.page_count,
                SourceDocument.sha256,
                SourceDocument.imported_at,
            )
            .order_by(SourceDocument.imported_at, SourceDocument.id)
            .limit(100)
        ).mappings()
        return DocumentPage(items=[DocumentSummary.model_validate(dict(row)) for row in rows])
