import hashlib
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from apps.audit.services import log_audit_event
from apps.billing.services import enforce_quota
from apps.common.mixins import TenantModelViewSet
from apps.common.permissions import IsOrganizationManager, IsOrganizationMember
from apps.documents.models import Document
from apps.documents.tasks import process_document_task
from apps.knowledge.models import KnowledgeBase

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
}
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB


class DocumentSerializer(serializers.ModelSerializer):
    knowledge_base_name = serializers.CharField(source="knowledge_base.name", read_only=True)

    class Meta:
        model = Document
        fields = [
            "id",
            "knowledge_base",
            "knowledge_base_name",
            "title",
            "mime_type",
            "file_size",
            "sha256_checksum",
            "status",
            "chunk_count",
            "celery_task_id",
            "error_message",
            "metadata",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "knowledge_base_name",
            "mime_type",
            "file_size",
            "sha256_checksum",
            "status",
            "chunk_count",
            "celery_task_id",
            "error_message",
            "created_at",
            "updated_at",
        ]


class DocumentUploadSerializer(serializers.Serializer):
    knowledge_base = serializers.UUIDField()
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    file = serializers.FileField()

    def validate_file(self, f):
        if f.size > MAX_FILE_SIZE_BYTES:
            raise serializers.ValidationError("File exceeds maximum allowed size of 20MB.")
        content_type = getattr(f, "content_type", "application/octet-stream")
        ext_ok = f.name.lower().endswith((".pdf", ".txt", ".md", ".csv"))
        if content_type not in ALLOWED_MIME_TYPES and not ext_ok:
            raise serializers.ValidationError("Unsupported file type. Allowed: PDF, TXT, MD, CSV.")
        return f


class DocumentViewSet(TenantModelViewSet):
    serializer_class = DocumentSerializer
    queryset = Document.objects.select_related("knowledge_base").all()
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ["knowledge_base", "status"]
    search_fields = ["title"]

    def get_permissions(self):
        if self.action in ("create", "destroy", "reprocess"):
            return [IsOrganizationManager()]
        return [IsOrganizationMember()]

    def create(self, request, *args, **kwargs):
        enforce_quota(request.organization, "documents", 1)
        upload_ser = DocumentUploadSerializer(data=request.data)
        upload_ser.is_valid(raise_exception=True)

        kb = KnowledgeBase.objects.filter(
            id=upload_ser.validated_data["knowledge_base"],
            organization=request.organization,
        ).first()
        if not kb:
            return Response({"detail": "Knowledge base not found in organization."}, status=status.HTTP_404_NOT_FOUND)

        uploaded_file = upload_ser.validated_data["file"]
        enforce_quota(request.organization, "storage_mb", max(1, uploaded_file.size // (1024 * 1024)))

        sha256 = hashlib.sha256()
        for chunk in uploaded_file.chunks():
            sha256.update(chunk)
        uploaded_file.seek(0)
        checksum = sha256.hexdigest()

        title = upload_ser.validated_data.get("title") or uploaded_file.name
        mime_type = getattr(uploaded_file, "content_type", "application/pdf") or "application/pdf"
        if uploaded_file.name.lower().endswith(".pdf"):
            mime_type = "application/pdf"

        doc = Document.objects.create(
            organization=request.organization,
            knowledge_base=kb,
            uploaded_by=request.user,
            title=title,
            file=uploaded_file,
            mime_type=mime_type,
            file_size=uploaded_file.size,
            sha256_checksum=checksum,
            status=Document.Status.PENDING,
        )
        task = process_document_task.delay(str(doc.id), str(request.organization.id))
        doc.celery_task_id = getattr(task, "id", "") or ""
        doc.save(update_fields=["celery_task_id"])

        log_audit_event(
            request.organization, request.user, "document.uploaded", "Document", str(doc.id),
            metadata={"title": doc.title, "size": doc.file_size}, request=request
        )
        return Response(DocumentSerializer(doc).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def reprocess(self, request, pk=None):
        doc = self.get_object()
        doc.status = Document.Status.PENDING
        doc.error_message = ""
        doc.save(update_fields=["status", "error_message", "updated_at"])
        task = process_document_task.delay(str(doc.id), str(request.organization.id))
        doc.celery_task_id = getattr(task, "id", "") or ""
        doc.save(update_fields=["celery_task_id"])
        return Response(DocumentSerializer(doc).data)
