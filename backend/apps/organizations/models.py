import secrets
from datetime import timedelta
from django.conf import settings as django_settings
from django.db import models
from django.utils import timezone
from apps.common.models import TimeStampedModel, UUIDModel


class Organization(UUIDModel, TimeStampedModel):
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=160, unique=True, db_index=True)
    industry = models.CharField(max_length=100, blank=True, default="")
    website = models.URLField(blank=True, default="")
    settings = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_organizations",
    )
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class OrganizationMembership(UUIDModel, TimeStampedModel):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        MANAGER = "manager", "Manager"
        MEMBER = "member", "Member"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(django_settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [("organization", "user")]
        indexes = [
            models.Index(fields=["organization", "user", "is_active"]),
        ]

    def __str__(self):
        return f"{self.user.email} @ {self.organization.slug} ({self.role})"


class OrganizationInvitation(UUIDModel, TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        EXPIRED = "expired", "Expired"
        REVOKED = "revoked", "Revoked"

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="invitations")
    email = models.EmailField(db_index=True)
    role = models.CharField(
        max_length=20,
        choices=OrganizationMembership.Role.choices,
        default=OrganizationMembership.Role.MEMBER,
    )
    token = models.CharField(max_length=128, unique=True, db_index=True)
    invited_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="sent_invitations"
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    expires_at = models.DateTimeField()

    @classmethod
    def issue(cls, organization, email, role, invited_by):
        return cls.objects.create(
            organization=organization,
            email=email.strip().lower(),
            role=role,
            token=secrets.token_urlsafe(40),
            invited_by=invited_by,
            expires_at=timezone.now() + timedelta(days=7),
        )
