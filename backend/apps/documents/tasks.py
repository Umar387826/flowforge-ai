
import io
import re

import structlog
from celery import shared_task
from django.db import transaction
from pypdf import PdfReader

from apps.common.tenancy import tenant_context
from apps.documents.models import Document
from apps.knowledge.embeddings import (
    EmbeddingProviderError,
    TransientEmbeddingProviderError,
    get_embedding_provider,
)
from apps.knowledge.models import DocumentChunk


logger = structlog.get_logger(__name__)


def extract_text_from_file(doc: Document) -> str:
    doc.file.open("rb")
    try:
        raw_bytes = doc.file.read()
    finally:
        doc.file.close()

    if (
        doc.mime_type == "application/pdf"
        or doc.file.name.lower().endswith(".pdf")
    ):
        reader = PdfReader(io.BytesIO(raw_bytes))
        pages = []

        for idx, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(f"[Page {idx}]\n{text}")

        return "\n\n".join(pages)

    return raw_bytes.decode("utf-8", errors="replace")


def normalize_and_chunk_text(
    text: str,
    chunk_size: int = 800,
    chunk_overlap: int = 120,
) -> list[str]:
    normalized = re.sub(r"\r\n?", "\n", text)
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized).strip()

    if not normalized:
        return []

    chunks: list[str] = []
    start = 0
    length = len(normalized)
    step = max(1, chunk_size - chunk_overlap)

    while start < length:
        end = min(length, start + chunk_size)

        if end < length:
            split_pos = normalized.rfind(
                " ",
                start + int(chunk_size * 0.6),
                end,
            )
            if split_pos != -1:
                end = split_pos

        piece = normalized[start:end].strip()

        if piece:
            chunks.append(piece)

        if end >= length:
            break

        start = max(start + 1, end - chunk_overlap)

    return chunks


class TransientDocumentError(Exception):
    pass


@shared_task(
    bind=True,
    name="apps.documents.tasks.process_document_task",
    queue="documents",
    autoretry_for=(
        TransientDocumentError,
        TransientEmbeddingProviderError,
    ),
    retry_backoff=True,
    retry_backoff_max=120,
    retry_jitter=True,
    max_retries=4,
    acks_late=True,
)
def process_document_task(self, document_id: str, organization_id: str):
    """
    Background document processing and pgvector indexing.
    Enforces tenant context and idempotent chunk replacement.
    """

    log = logger.bind(
        document_id=document_id,
        organization_id=organization_id,
        task_id=self.request.id,
    )

    with tenant_context(organization_id):
        doc = (
            Document.objects
            .select_related("knowledge_base")
            .filter(id=document_id)
            .first()
        )

        if not doc:
            log.warning("document_not_found_or_tenant_mismatch")
            return {"status": "rejected_tenant_mismatch"}

        if str(doc.organization_id) != str(organization_id):
            log.error("document_tenant_verification_failed")
            raise PermissionError(
                "Document does not belong to provided tenant context."
            )

        if (
            doc.status == Document.Status.INDEXED
            and doc.chunks.exists()
        ):
            log.info("document_already_indexed_idempotent_skip")
            return {
                "status": "already_indexed",
                "chunk_count": doc.chunk_count,
            }

        doc.status = Document.Status.PROCESSING
        doc.celery_task_id = self.request.id or ""
        doc.error_message = ""
        doc.save(
            update_fields=[
                "status",
                "celery_task_id",
                "error_message",
                "updated_at",
            ]
        )

        try:
            raw_text = extract_text_from_file(doc)

            chunks_text = normalize_and_chunk_text(
                raw_text,
                chunk_size=doc.knowledge_base.chunk_size,
                chunk_overlap=doc.knowledge_base.chunk_overlap,
            )

            if not chunks_text:
                raise ValueError(
                    "No extractable text found in uploaded document."
                )

            provider = get_embedding_provider(
                model=doc.knowledge_base.embedding_model
            )

            vectors = provider.embed_texts(chunks_text)

            if len(vectors) != len(chunks_text):
                raise ValueError(
                    "Embedding count does not match document chunk count."
                )

            with transaction.atomic():
                DocumentChunk.objects.filter(document=doc).delete()

                chunk_objs = [
                    DocumentChunk(
                        organization=doc.organization,
                        knowledge_base=doc.knowledge_base,
                        document=doc,
                        chunk_index=idx,
                        content=content,
                        token_count=max(1, len(content) // 4),
                        metadata={
                            "title": doc.title,
                            "mime_type": doc.mime_type,
                            "chunk_index": idx,
                        },
                        embedding=vector,
                    )
                    for idx, (content, vector) in enumerate(
                        zip(chunks_text, vectors)
                    )
                ]

                DocumentChunk.objects.bulk_create(
                    chunk_objs,
                    batch_size=100,
                )

                doc.status = Document.Status.INDEXED
                doc.chunk_count = len(chunk_objs)
                doc.error_message = ""

                doc.save(
                    update_fields=[
                        "status",
                        "chunk_count",
                        "error_message",
                        "updated_at",
                    ]
                )

            log.info(
                "document_indexed_successfully",
                chunk_count=len(chunk_objs),
            )

            from apps.workflows.engine import (
                dispatch_workflows_for_event,
            )

            dispatch_workflows_for_event(
                organization_id=str(doc.organization_id),
                trigger_type="document_indexed",
                payload={
                    "document_id": str(doc.id),
                    "title": doc.title,
                    "chunk_count": doc.chunk_count,
                },
            )

            return {
                "status": "indexed",
                "chunk_count": doc.chunk_count,
            }

        except EmbeddingProviderError as exc:
            doc.status = Document.Status.FAILED
            doc.error_message = str(exc)
            doc.save(
                update_fields=[
                    "status",
                    "error_message",
                    "updated_at",
                ]
            )

            log.warning(
                "document_embedding_error",
                error=str(exc),
            )
            raise

        except Exception as exc:
            doc.status = Document.Status.FAILED
            doc.error_message = str(exc)
            doc.save(
                update_fields=[
                    "status",
                    "error_message",
                    "updated_at",
                ]
            )

            log.error(
                "document_processing_failed",
                error=str(exc),
            )

            return {
                "status": "failed",
                "error": str(exc),
            }

