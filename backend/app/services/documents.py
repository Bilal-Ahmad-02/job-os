"""Immutable local document ingestion and metadata-only queries."""

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.models.document_versions import DocumentVersion
from app.models.documents import SourceDocument
from app.pdf_probe import MAX_PDF
from app.schemas.documents import DocumentKind, DocumentPage, DocumentSummary
from app.services.pdf_reader import DocumentError, probe_pdf


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
    count = probe_pdf(raw)["pages"]
    return PreparedDocument(path.name, kind, raw, hashlib.sha256(raw).hexdigest(), count)


def import_documents(
    engine: Engine, documents: list[PreparedDocument], *, replaces: str | None = None
) -> list[str]:
    if not 1 <= len(documents) <= 10:
        raise DocumentError("document_batch_limit")
    if replaces is not None:
        try:
            replaces = str(UUID(replaces))
        except (ValueError, AttributeError) as exc:
            raise DocumentError("document_version_target") from exc
        if len(documents) != 1:
            raise DocumentError("document_version_batch")
    identities = []
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        parent = session.get(DocumentVersion, replaces) if replaces else None
        if replaces and parent is None:
            raise DocumentError("document_version_target")
        for document in documents:
            if (
                document.kind not in ("cv", "certificate", "transcript")
                or not 1 <= len(document.filename) <= 255
                or type(document.page_count) is not int
                or not 1 <= document.page_count <= 100
                or not 0 < len(document.content) <= MAX_PDF
                or hashlib.sha256(document.content).hexdigest() != document.sha256
            ):
                raise DocumentError("document_invalid")
            if (
                parent is not None
                and session.get(SourceDocument, parent.document_id).kind != document.kind
            ):
                raise DocumentError("document_kind_conflict")
            existing = session.scalar(
                select(SourceDocument).where(SourceDocument.sha256 == document.sha256)
            )
            if existing is not None:
                if existing.kind != document.kind:
                    raise DocumentError("document_kind_conflict")
                if parent is not None:
                    existing_version = session.get(DocumentVersion, existing.id)
                    if existing_version is None:
                        raise DocumentError("document_version_invalid")
                    # Exact retries return the original result, even after a later revision.
                    if existing_version.previous_id == parent.document_id:
                        identities.append(existing.id)
                        continue
                    if existing.id != parent.document_id:
                        raise DocumentError("document_version_duplicate")
                    if (
                        session.scalar(
                            select(DocumentVersion.document_id).where(
                                DocumentVersion.previous_id == parent.document_id
                            )
                        )
                        is not None
                    ):
                        raise DocumentError("document_version_conflict")
                identities.append(existing.id)
                continue
            if (
                parent is not None
                and session.scalar(
                    select(DocumentVersion.document_id).where(
                        DocumentVersion.previous_id == parent.document_id
                    )
                )
                is not None
            ):
                raise DocumentError("document_version_conflict")
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
            session.add(
                DocumentVersion(
                    document_id=record.id,
                    family_id=parent.family_id if parent else record.id,
                    version=parent.version + 1 if parent else 1,
                    previous_id=parent.document_id if parent else None,
                )
            )
            session.flush()
            identities.append(record.id)
    return identities


def list_documents(engine: Engine) -> DocumentPage:
    with Session(engine) as session, session.begin():
        rows = session.execute(
            select(
                SourceDocument.id,
                DocumentVersion.family_id,
                DocumentVersion.version,
                DocumentVersion.previous_id,
                (
                    DocumentVersion.version
                    == func.max(DocumentVersion.version).over(
                        partition_by=DocumentVersion.family_id
                    )
                ).label("is_latest"),
                SourceDocument.filename,
                SourceDocument.kind,
                SourceDocument.byte_size,
                SourceDocument.page_count,
                SourceDocument.sha256,
                SourceDocument.imported_at,
            )
            .join(DocumentVersion, DocumentVersion.document_id == SourceDocument.id)
            .order_by(SourceDocument.imported_at, SourceDocument.id)
            .limit(100)
        ).mappings()
        return DocumentPage(items=[DocumentSummary.model_validate(dict(row)) for row in rows])
