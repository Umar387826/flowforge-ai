from django.urls import include, path
from rest_framework.routers import DefaultRouter
from apps.organizations.views import (
    AcceptInvitationView,
    CurrentOrganizationView,
    InvitationViewSet,
    MembershipViewSet,
    OrganizationListCreateView,
    SwitchOrganizationView,
)

router = DefaultRouter()
router.register("memberships", MembershipViewSet, basename="organization-memberships")
router.register("invitations", InvitationViewSet, basename="organization-invitations")

urlpatterns = [
    path("", OrganizationListCreateView.as_view(), name="organizations-list-create"),
    path("current/", CurrentOrganizationView.as_view(), name="organizations-current"),
    path("switch/", SwitchOrganizationView.as_view(), name="organizations-switch"),
    path("invitations/accept/", AcceptInvitationView.as_view(), name="organizations-accept-invite"),
    path("", include(router.urls)),
]
