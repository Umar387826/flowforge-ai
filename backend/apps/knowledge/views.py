from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.audit.services import log_audit_event
from apps.common.mixins import TenantModelViewSet
from apps.common.permissions import IsOrganizationManager, IsOrganizationMember
from apps.knowledge.embeddings import EmbeddingProviderError
from apps.knowledge.models import KnowledgeBase
from apps.knowledge.rag import retrieve_relevant_chunks


class KnowledgeBaseSerializer(serializers.ModelSerializer):
    document_count = serializers.IntegerField(source="documents.count", read_only=True)
    chunk_count = serializers.IntegerField(source="chunks.count", read_only=True)

    class Meta:
        model = KnowledgeBase
        fields = [
            "id",
            "name",
            "description",
            "embedding_model",
            "chunk_size",
            "chunk_overlap",
            "document_count",
            "chunk_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "document_count", "chunk_count", "created_at", "updated_at"]


class KnowledgeBaseViewSet(TenantModelViewSet):
    serializer_class = KnowledgeBaseSerializer
    queryset = KnowledgeBase.objects.all()
    search_fields = ["name", "description"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsOrganizationManager()]
        return [IsOrganizationMember()]

    def perform_create(self, serializer):
        kb = serializer.save(organization=self.request.organization)
        log_audit_event(
            self.request.organization, self.request.user, "knowledge_base.created", "KnowledgeBase", str(kb.id), request=self.request
        )

    @action(detail=True, methods=["post"])
    def query(self, request, pk=None):
        kb = self.get_object()
        q = request.data.get("query", "").strip()
        top_k = min(int(request.data.get("top_k", 5)), 20)
        if not q:
            return Response({"detail": "Query string is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            chunks = retrieve_relevant_chunks(request.organization.id, [kb.id], q, top_k=top_k)
        except EmbeddingProviderError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response(
            {
                "query": q,
                "results": [
                    {
                        "chunk_id": c.chunk_id,
                        "document_id": c.document_id,
                        "document_title": c.document_title,
                        "chunk_index": c.chunk_index,
                        "similarity": c.similarity,
                        "content": c.content,
                    }
                    for c in chunks
                ],
            }
        )
