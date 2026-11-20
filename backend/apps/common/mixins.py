import uuid
from django.db import transaction
from rest_framework import exceptions, viewsets
from rest_framework_simplejwt.authentication import JWTAuthentication
from apps.common.tenancy import apply_pg_tenant_token, build_signed_tenant_token, tenant_context


class TenantScopedMixin:
    """
    DRF View / ViewSet mixin that:
    1. Authenticates the user (supporting JWT before entering the atomic RLS transaction).
    2. Verifies active OrganizationMembership for X-Organization-ID (never trusts unverified client IDs).
    3. Wraps view execution in `with tenant_context(org.id, actor_id=user.id)` so PostgreSQL RLS
       verifies the signed HMAC token at the database boundary for all queries.
    4. Scopes get_queryset() to request.organization and auto-injects organization on create.
    """

    require_organization = True

    def _resolve_user_and_membership(self, request):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            jwt_auth = JWTAuthentication()
            try:
                auth_result = jwt_auth.authenticate(request)
                if auth_result is not None:
                    user, _ = auth_result
                    request._force_user = user
                    request.user = user
            except Exception:
                # Let DRF's normal authentication/permission pipeline raise 401 cleanly
                return None, None, None

        if not user or not user.is_authenticated:
            return None, None, None

        from apps.organizations.models import OrganizationMembership

        requested_org_id = request.headers.get("X-Organization-ID")
        # Bind actor-only signed token for membership verification under RLS
        actor_token = build_signed_tenant_token(None, actor_id=user.id)
        with transaction.atomic():
            apply_pg_tenant_token(actor_token)
            qs = OrganizationMembership.objects.select_related("organization").filter(
                user=user,
                is_active=True,
                organization__deleted_at__isnull=True,
            )
            if requested_org_id:
                try:
                    org_uuid = uuid.UUID(str(requested_org_id))
                except ValueError as exc:
                    raise exceptions.ValidationError({"X-Organization-ID": "Invalid organization UUID."}) from exc
                membership = qs.filter(organization_id=org_uuid).first()
                if not membership:
                    raise exceptions.PermissionDenied(
                        "You do not have active membership in the requested organization."
                    )
            else:
                membership = qs.order_by("created_at").first()

        if not membership and self.require_organization:
            raise exceptions.PermissionDenied("No active organization membership found.")

        org = membership.organization if membership else None
        return user, org, membership

    def dispatch(self, request, *args, **kwargs):
        try:
            user, org, membership = self._resolve_user_and_membership(request)
        except exceptions.APIException as exc:
            # Let DRF handle exceptions cleanly via finalize_response
            self.args = args
            self.kwargs = kwargs
            drf_request = self.initialize_request(request, *args, **kwargs)
            self.request = drf_request
            self.headers = self.default_response_headers
            response = self.handle_exception(exc)
            return self.finalize_response(drf_request, response, *args, **kwargs)

        request.organization = org
        request.membership = membership

        if org is not None:
            with tenant_context(org.id, actor_id=user.id):
                return super().dispatch(request, *args, **kwargs)
        return super().dispatch(request, *args, **kwargs)

    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request, "organization", None)
        if org is None:
            return qs.none()
        return qs.filter(organization=org)

    def perform_create(self, serializer):
        serializer.save(organization=self.request.organization)


class TenantModelViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    pass


class TenantReadOnlyViewSet(TenantScopedMixin, viewsets.ReadOnlyModelViewSet):
    pass
