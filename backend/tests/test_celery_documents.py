from unittest.mock import patch
from django.core.files.uploadedfile import SimpleUploadedFile
import pytest
from apps.common.tenancy import tenant_context
from apps.documents.models import Document
from apps.documents.tasks import process_document_task
from apps.knowledge.embeddings import EmbeddingProviderError
from apps.knowledge.models import DocumentChunk, KnowledgeBase


@pytest.mark.django_db
def test_document_processing_idempotency_retry_and_tenant_mismatch(create_org_with_owner):
    org_a, user_a = create_org_with_owner("doc_a@test.com", "Doc Org A")
    org_b, _ = create_org_with_owner("doc_b@test.com", "Doc Org B")

    with tenant_context(org_a.id, actor_id=user_a.id):
        kb = KnowledgeBase.objects.create(organization=org_a, name="Property Brochures")
        uploaded = SimpleUploadedFile("villa.txt", b"Luxury 4-bedroom villa priced at $1.2M in Austin.", content_type="text/plain")
        doc = Document.objects.create(
            organization=org_a,
            knowledge_base=kb,
            uploaded_by=user_a,
            title="Villa Brochure",
            file=uploaded,
            mime_type="text/plain",
            file_size=uploaded.size,
            sha256_checksum="abc123",
        )

    # Tenant mismatch rejected
    mismatch = process_document_task(str(doc.id), str(org_b.id))
    assert mismatch["status"] == "rejected_tenant_mismatch"

    # Transient embedding failure triggers retry and keeps clean state
    with patch("apps.documents.tasks.get_embedding_provider") as mock_provider_fn:
        mock_provider_fn.return_value.embed_texts.side_effect = EmbeddingProviderError("rate limit")
        with pytest.raises(EmbeddingProviderError):
            process_document_task(str(doc.id), str(org_a.id))

    # Successful run + idempotent second run produce exact 1 set of chunks (no duplicates)
    fake_vec = [0.01] * 1536
    with patch("apps.documents.tasks.get_embedding_provider") as mock_provider_fn:
        mock_provider_fn.return_value.embed_texts.side_effect = lambda texts: [fake_vec for _ in texts]
        res1 = process_document_task(str(doc.id), str(org_a.id))
        assert res1["status"] == "indexed"
        res2 = process_document_task(str(doc.id), str(org_a.id))
        assert res2["status"] == "already_indexed"

    with tenant_context(org_a.id):
        doc.refresh_from_db()
        assert doc.status == Document.Status.INDEXED
        assert DocumentChunk.objects.filter(document=doc).count() == doc.chunk_count
