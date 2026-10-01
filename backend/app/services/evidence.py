"""Private page extraction and source-checked drafts; never writes the active profile."""

import hashlib
import json
import unicodedata
from datetime import UTC, datetime
from importlib.metadata import version

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.models.documents import SourceDocument
from app.models.evidence import DocumentText, ProfileDraft
from app.schemas.evidence import DraftPayload, DraftResponse, StoredDraft
from app.services.pdf_reader import DocumentError, probe_pdf


class EvidenceError(Exception):
    """Fixed error code without document content."""


def canonical(text: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", text).split())


def extract_document(engine: Engine, document_id: str, *, timeout: float = 15) -> int:
    with Session(engine) as session, session.begin():
        source = session.get(SourceDocument, document_id)
        if source is None:
            raise EvidenceError("source_missing")
        raw, digest, count = source.content, source.sha256, source.page_count
        if len(raw) != source.byte_size or hashlib.sha256(raw).hexdigest() != digest:
            raise EvidenceError("source_changed")
        prior = session.get(DocumentText, document_id)
        if prior is not None:
            if prior.source_sha256 != digest:
                raise EvidenceError("source_changed")
            return len(json.loads(prior.pages))
    result = probe_pdf(raw, extract=True, timeout=timeout)
    if result["pages"] != count:
        raise DocumentError("document_invalid")
    if not any(canonical(page) for page in result["text"]):
        raise EvidenceError("source_no_text")
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        source = session.get(SourceDocument, document_id)
        if source is None or source.sha256 != digest:
            raise EvidenceError("source_changed")
        prior = session.get(DocumentText, document_id)
        if prior is not None:
            if prior.source_sha256 != digest:
                raise EvidenceError("source_changed")
            return len(json.loads(prior.pages))
        session.add(
            DocumentText(
                document_id=document_id,
                source_sha256=digest,
                extractor=f"pypdf-{version('pypdf')}/plain-v1",
                created_at=datetime.now(UTC).isoformat(),
                pages=json.dumps(result["text"], ensure_ascii=False),
            )
        )
    return count


def get_draft(engine: Engine) -> DraftResponse:
    with Session(engine) as session, session.begin():
        row = session.get(ProfileDraft, 1)
        if row is None:
            return DraftResponse(draft=None)
        return DraftResponse(
            draft=StoredDraft(
                created_at=row.created_at, payload=DraftPayload.model_validate_json(row.payload)
            )
        )


def store_draft(engine: Engine, payload: DraftPayload) -> DraftResponse:
    # Revalidate even if a caller built the model with unchecked model_construct/copy.
    payload = DraftPayload.model_validate_json(payload.model_dump_json())
    with Session(engine.execution_options(oracle_write=True)) as session, session.begin():
        for evidence in payload.evidence:
            for citation in evidence.citations:
                identity = str(citation.document_id)
                source = session.get(SourceDocument, identity)
                extracted = session.get(DocumentText, identity)
                if source is None or extracted is None:
                    raise EvidenceError("source_missing")
                if source.sha256 != extracted.source_sha256:
                    raise EvidenceError("source_changed")
                pages = json.loads(extracted.pages)
                excerpt = canonical(citation.excerpt)
                if (
                    len(pages) != source.page_count
                    or citation.page > len(pages)
                    or not excerpt
                    or excerpt not in canonical(pages[citation.page - 1])
                ):
                    raise EvidenceError("citation_invalid")
        row = session.get(ProfileDraft, 1)
        if row is not None:
            if DraftPayload.model_validate_json(row.payload) != payload:
                raise EvidenceError("draft_exists")
        else:
            row = ProfileDraft(
                id=1, created_at=datetime.now(UTC).isoformat(), payload=payload.model_dump_json()
            )
            session.add(row)
        result = DraftResponse(draft=StoredDraft(created_at=row.created_at, payload=payload))
    return result
