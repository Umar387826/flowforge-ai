import re
from dataclasses import dataclass
from pgvector.django import CosineDistance
from apps.knowledge.embeddings import get_embedding_provider
from apps.knowledge.models import DocumentChunk

INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?previous\s+instructions", re.IGNORECASE),
    re.compile(r"reveal\s+(your\s+)?system\s+prompt", re.IGNORECASE),
    re.compile(r"disregard\s+(the\s+)?above", re.IGNORECASE),
    re.compile(r"you\s+are\s+now\s+in\s+developer\s+mode", re.IGNORECASE),
]


def sanitize_untrusted_text(text: str) -> str:
    """Neutralize prompt-injection directives embedded inside uploaded documents or user messages."""
    cleaned = text.replace("\x00", "")
    for pat in INJECTION_PATTERNS:
        cleaned = pat.sub("[redacted-instruction]", cleaned)
    return cleaned


@dataclass
class RetrievedChunk:
    chunk_id: str
    document_id: str
    document_title: str
    chunk_index: int
    content: str
    similarity: float
    metadata: dict


def retrieve_relevant_chunks(
    organization_id,
    knowledge_base_ids: list,
    query: str,
    top_k: int = 5,
    min_similarity: float = 0.25,
) -> list[RetrievedChunk]:
    """
    Strictly tenant-scoped pgvector cosine similarity search.
    Both PostgreSQL RLS (via active tenant_context) AND explicit organization_id filter
    guarantee zero cross-tenant document retrieval.
    """
    if not knowledge_base_ids or not query.strip():
        return []

    provider = get_embedding_provider()
    query_vec = provider.embed_texts([query])[0]

    qs = (
        DocumentChunk.objects.select_related("document", "knowledge_base")
        .filter(
            organization_id=organization_id,
            knowledge_base_id__in=knowledge_base_ids,
            document__deleted_at__isnull=True,
        )
        .annotate(distance=CosineDistance("embedding", query_vec))
        .order_by("distance")[:top_k]
    )

    results: list[RetrievedChunk] = []
    for chunk in qs:
        similarity = max(0.0, 1.0 - float(chunk.distance))
        if similarity >= min_similarity:
            results.append(
                RetrievedChunk(
                    chunk_id=str(chunk.id),
                    document_id=str(chunk.document_id),
                    document_title=chunk.document.title,
                    chunk_index=chunk.chunk_index,
                    content=sanitize_untrusted_text(chunk.content),
                    similarity=round(similarity, 4),
                    metadata=chunk.metadata,
                )
            )
    return results


def build_grounded_rag_context(chunks: list[RetrievedChunk], max_chars: int = 12000) -> tuple[str, list[dict]]:
    if not chunks:
        return (
            "NO_RELEVANT_DOCUMENTS_FOUND: No matching facts were found in the organization's knowledge base. "
            "Do NOT invent facts. Clearly inform the user that the answer is not present in the supplied knowledge base.",
            [],
        )

    parts = []
    citations = []
    total_chars = 0
    for idx, c in enumerate(chunks, start=1):
        entry = f"[Source {idx}: {c.document_title} (Chunk {c.chunk_index}, Score {c.similarity})]\n{c.content}\n"
        if total_chars + len(entry) > max_chars:
            break
        parts.append(entry)
        total_chars += len(entry)
        citations.append(
            {
                "source_number": idx,
                "document_id": c.document_id,
                "document_title": c.document_title,
                "chunk_index": c.chunk_index,
                "similarity": c.similarity,
                "excerpt": c.content[:240],
            }
        )

    return "\n---\n".join(parts), citations
