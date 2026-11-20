import hashlib
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from apps.accounts.models import User
from apps.agents.models import AIAgent
from apps.audit.services import log_audit_event
from apps.billing.services import ensure_free_subscription
from apps.common.tenancy import tenant_context
from apps.conversations.models import Conversation, Message
from apps.documents.models import Document
from apps.knowledge.models import KnowledgeBase
from apps.leads.models import Lead
from apps.notifications.models import Notification
from apps.organizations.models import Organization, OrganizationMembership
from apps.workflows.models import Workflow


PAKISTAN_DEFAULTS = {
    "currency": "PKR",
    "timezone": "Asia/Karachi",
    "date_format": "DD-MM-YYYY",
    "country": "PK",
}


class Command(BaseCommand):
    help = "Seed idempotent Pakistan Edition demo organizations, agents, leads, and workflows."

    def handle(self, *args, **options):
        user_a, created_ua = User.objects.get_or_create(
            email="amina.khan@indusrealty.pk",
            defaults={
                "full_name": "Amina Khan",
                "email_verified": True,
            },
        )
        if created_ua or not user_a.has_usable_password():
            user_a.set_password("IndusRealEstate#2026")
            user_a.save()

        user_b, created_ub = User.objects.get_or_create(
            email="usman.tariq@margallacrest.pk",
            defaults={
                "full_name": "Usman Tariq",
                "email_verified": True,
            },
        )
        if created_ub or not user_b.has_usable_password():
            user_b.set_password("MargallaCrest#2026")
            user_b.save()

        org_a, _ = Organization.objects.get_or_create(
            slug="indus-horizon-realty",
            defaults={
                "name": "Indus Horizon Realty (Pvt) Ltd",
                "industry": "Real Estate & Property Development",
                "website": "https://indushorizon.pk",
                "created_by": user_a,
                "settings": {**PAKISTAN_DEFAULTS, "city": "Lahore / Karachi"},
            },
        )

        with tenant_context(org_a.id, actor_id=user_a.id):
            OrganizationMembership.objects.get_or_create(
                organization=org_a,
                user=user_a,
                defaults={"role": OrganizationMembership.Role.OWNER, "is_active": True},
            )
            ensure_free_subscription(org_a)

            kb, _ = KnowledgeBase.objects.get_or_create(
                organization=org_a,
                name="DHA Lahore & Clifton Karachi Brochures",
                defaults={
                    "description": "Verified PKR pricing schedules, 1-Kanal plots, and Clifton waterfront apartments.",
                    "chunk_size": 800,
                    "chunk_overlap": 120,
                },
            )

            sample_brochure = (
                "Indus Horizon Realty (Pvt) Ltd — Verified Inventory Guide (PKR)\n"
                "1. DHA Phase 6, Lahore: 1 Kanal Residential Plot — PKR 5.25 Crore (52,500,000 PKR). "
                "Possession ready, 40-ft carpeted boulevard, 25% down payment, 4 quarterly installments.\n"
                "2. Clifton Block 4, Karachi: 3-Bedroom Sea-View Apartment — PKR 4.80 Crore (48,000,000 PKR). "
                "Standby generator, reserved basement parking, possession date 15-08-2026.\n"
                "Office Hours: Monday to Saturday, 09:30 PKT to 18:30 PKT (Asia/Karachi)."
            ).encode("utf-8")
            checksum = hashlib.sha256(sample_brochure).hexdigest()
            doc, created_doc = Document.objects.get_or_create(
                organization=org_a,
                knowledge_base=kb,
                title="DHA Phase 6 & Clifton Inventory PKR 2026.txt",
                defaults={
                    "uploaded_by": user_a,
                    "mime_type": "text/plain",
                    "file_size": len(sample_brochure),
                    "sha256_checksum": checksum,
                    "status": Document.Status.PENDING,
                },
            )
            if created_doc and not doc.file:
                doc.file.save("dha_clifton_inventory_2026.txt", ContentFile(sample_brochure), save=True)

            agent, _ = AIAgent.objects.get_or_create(
                organization=org_a,
                name="Property Assistant (PK)",
                defaults={
                    "description": "Grounds buyer inquiries in DHA Lahore and Clifton Karachi PKR inventory.",
                    "system_instructions": (
                        "You are Property Assistant for Indus Horizon Realty in Pakistan. Quote all prices in PKR, "
                        "follow Asia/Karachi timings, format dates as DD-MM-YYYY, and capture buyer leads."
                    ),
                    "enabled_tools": ["capture_lead"],
                    "widget_config": {
                        "welcome_message": "Assalam-o-Alaikum! Ask about DHA Lahore or Clifton Karachi properties (PKR).",
                        "primary_color": "#1d4ed8",
                    },
                },
            )
            agent.knowledge_bases.add(kb)

            conv, _ = Conversation.objects.get_or_create(
                organization=org_a,
                agent=agent,
                title="DHA Phase 6 Buyer Inquiry",
                defaults={"started_by": user_a, "channel": Conversation.Channel.DASHBOARD},
            )
            if not conv.messages.exists():
                Message.objects.create(
                    organization=org_a,
                    conversation=conv,
                    sender=user_a,
                    role=Message.Role.USER,
                    content="What is the price of a 1 Kanal plot in DHA Phase 6 Lahore?",
                )
                Message.objects.create(
                    organization=org_a,
                    conversation=conv,
                    role=Message.Role.ASSISTANT,
                    content=(
                        "A possession-ready 1 Kanal residential plot in DHA Phase 6, Lahore is listed at "
                        "PKR 5.25 Crore with 25% down payment and 4 quarterly installments [Source 1]."
                    ),
                    citations=[
                        {
                            "source_number": 1,
                            "document_id": str(doc.id),
                            "document_title": doc.title,
                            "chunk_index": 0,
                            "similarity": 0.94,
                            "excerpt": "DHA Phase 6, Lahore: 1 Kanal Residential Plot — PKR 5.25 Crore.",
                        }
                    ],
                    token_usage={"input_tokens": 180, "output_tokens": 48, "total_tokens": 228},
                )

            Lead.objects.get_or_create(
                organization=org_a,
                email="saad.mahmood@lahorecapital.pk",
                defaults={
                    "full_name": "Saad Mahmood",
                    "phone": "+92 300 4128899",
                    "company": "Lahore Capital Ventures",
                    "preferences": {"city": "Lahore", "area": "DHA Phase 6", "budget_pkr": "PKR 5.25 Crore"},
                    "qualification_score": 86,
                    "qualification_reason": "Verified cash buyer targeting DHA Phase 6 1-Kanal plot.",
                    "status": Lead.Status.QUALIFIED,
                    "source_conversation": conv,
                },
            )

            Workflow.objects.get_or_create(
                organization=org_a,
                name="Qualify Buyer & Notify Sales (PK)",
                defaults={
                    "description": "Scores inbound real estate leads and dispatches workspace alerts.",
                    "trigger_type": Workflow.TriggerType.LEAD_CAPTURED,
                    "conditions": {"operator": "AND", "rules": [{"field": "email", "op": "exists"}]},
                    "actions": [
                        {"type": "ai_qualify_lead", "config": {}},
                        {"type": "hubspot_create_contact", "config": {"min_score": 60}},
                        {"type": "send_notification", "config": {"title": "Qualified Buyer Lead (PKR)"}},
                    ],
                    "is_active": True,
                },
            )

            if not Notification.objects.filter(organization=org_a).exists():
                Notification.objects.create(
                    organization=org_a,
                    user=user_a,
                    title="Pakistan Edition Workspace Ready",
                    message="Indus Horizon Realty configured with PKR billing, Asia/Karachi timezone, and DD-MM-YYYY dates.",
                    level=Notification.Level.SUCCESS,
                )

            log_audit_event(
                org_a,
                user_a,
                "workspace.demo_seeded",
                "Organization",
                str(org_a.id),
                metadata={"currency": "PKR", "timezone": "Asia/Karachi", "date_format": "DD-MM-YYYY"},
            )

        org_b, _ = Organization.objects.get_or_create(
            slug="margalla-crest-properties",
            defaults={
                "name": "Margalla Crest Properties",
                "industry": "Commercial Real Estate",
                "website": "https://margallacrest.pk",
                "created_by": user_b,
                "settings": {**PAKISTAN_DEFAULTS, "city": "Islamabad"},
            },
        )
        with tenant_context(org_b.id, actor_id=user_b.id):
            OrganizationMembership.objects.get_or_create(
                organization=org_b,
                user=user_b,
                defaults={"role": OrganizationMembership.Role.OWNER, "is_active": True},
            )
            ensure_free_subscription(org_b)

        self.stdout.write(
            self.style.SUCCESS(
                "Seeded Pakistan Edition demo workspaces: indus-horizon-realty & margalla-crest-properties (PKR, Asia/Karachi, DD-MM-YYYY)."
            )
        )
