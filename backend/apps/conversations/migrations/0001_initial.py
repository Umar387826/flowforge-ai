import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import apps.conversations.models


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ("organizations", "0001_initial"),
        ("agents", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Conversation",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("title", models.CharField(default="New Conversation", max_length=200)),
                ("channel", models.CharField(choices=[("dashboard", "Dashboard"), ("widget", "Public Widget"), ("api", "API")], default="dashboard", max_length=20)),
                ("visitor_session_token", models.CharField(db_index=True, default=apps.conversations.models.default_session_token, max_length=120)),
                ("visitor_email", models.EmailField(blank=True, default="", max_length=254)),
                ("is_closed", models.BooleanField(default=False)),
                ("agent", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="conversations", to="agents.aiagent")),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
                ("started_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="conversations", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-updated_at"], "indexes": [models.Index(fields=["organization", "agent"], name="conv_org_agent_idx")]},
        ),
        migrations.CreateModel(
            name="Message",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("deleted_at", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("role", models.CharField(choices=[("user", "User"), ("assistant", "Assistant"), ("system", "System")], max_length=20)),
                ("content", models.TextField()),
                ("citations", models.JSONField(blank=True, default=list)),
                ("token_usage", models.JSONField(blank=True, default=dict)),
                ("conversation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="conversations.conversation")),
                ("organization", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="%(app_label)s_%(class)ss", to="organizations.organization")),
                ("sender", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="sent_messages", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["created_at"], "indexes": [models.Index(fields=["organization", "conversation", "created_at"], name="msg_org_conv_idx")]},
        ),
    ]
