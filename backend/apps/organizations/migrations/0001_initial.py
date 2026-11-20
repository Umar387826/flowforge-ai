import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Organization",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=150)),
                ("slug", models.SlugField(max_length=160, unique=True)),
                ("industry", models.CharField(blank=True, default="", max_length=100)),
                ("website", models.URLField(blank=True, default="")),
                ("settings", models.JSONField(blank=True, default=dict)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_organizations", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="OrganizationMembership",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("role", models.CharField(choices=[("owner", "Owner"), ("admin", "Admin"), ("manager", "Manager"), ("member", "Member")], default="member", max_length=20)),
                ("is_active", models.BooleanField(default=True)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="memberships", to="organizations.organization")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="memberships", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "unique_together": {("organization", "user")},
                "indexes": [models.Index(fields=["organization", "user", "is_active"], name="organizatio_organiz_idx")],
            },
        ),
        migrations.CreateModel(
            name="OrganizationInvitation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("email", models.EmailField(db_index=True, max_length=254)),
                ("role", models.CharField(choices=[("owner", "Owner"), ("admin", "Admin"), ("manager", "Manager"), ("member", "Member")], default="member", max_length=20)),
                ("token", models.CharField(db_index=True, max_length=128, unique=True)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("accepted", "Accepted"), ("expired", "Expired"), ("revoked", "Revoked")], default="pending", max_length=20)),
                ("expires_at", models.DateTimeField()),
                ("invited_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sent_invitations", to=settings.AUTH_USER_MODEL)),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="invitations", to="organizations.organization")),
            ],
        ),
    ]
