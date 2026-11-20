# API Documentation

Interactive OpenAPI / Swagger UI is served at:
- Swagger UI: `GET /api/v1/docs/`
- ReDoc: `GET /api/v1/redoc/`
- OpenAPI JSON/YAML Schema: `GET /api/v1/schema/`

## Authentication & Tenant Headers

All authenticated tenant endpoints require:
- `Authorization: Bearer <jwt_access_token>`
- `X-Organization-ID: <organization_uuid>` (verified against `OrganizationMembership`; cross-tenant IDs return `403 Forbidden`)

## Endpoint Groups

| Prefix | Description |
| --- | --- |
| `/api/v1/health/` & `/api/v1/ready/` | Liveness and PostgreSQL/pgvector/Redis readiness probes |
| `/api/v1/auth/` | Register, login, logout (blacklist refresh), JWT refresh, profile, password reset, email verification |
| `/api/v1/organizations/` | List/create organizations, switch org, memberships RBAC, invitations |
| `/api/v1/agents/` | AI Agent CRUD, active toggle, RAG `test_query` |
| `/api/v1/knowledge/` | Knowledge Base CRUD and `query` vector similarity search |
| `/api/v1/documents/` | Multipart PDF/TXT/MD/CSV upload, status tracking, Celery `reprocess` |
| `/api/v1/conversations/` | Conversations CRUD, messages, `send_message`, public `/widget/<embed_key>/` |
| `/api/v1/leads/` | Lead CRUD, AI `qualify`, `sync_hubspot` |
| `/api/v1/workflows/` | Workflow CRUD, `toggle_active`, manual `trigger`, `executions/` history |
| `/api/v1/integrations/` | Google OAuth & HubSpot connections, signed webhook endpoints, `webhooks/inbound/<uuid>/`, `sync-logs/` |
| `/api/v1/billing/` | Plans, current subscription & usage, Stripe `checkout/`, `portal/`, `cancel/`, `webhook/` |
| `/api/v1/analytics/overview/` | Organization KPIs and quota utilization |
| `/api/v1/audit/` | Searchable immutable audit trail |
| `/api/v1/notifications/` | Workspace notifications |

## WebSockets

- `ws://<host>/ws/chat/<conversation_id>/?token=<jwt>` (authenticated org members)
- `ws://<host>/ws/chat/<conversation_id>/?widget_token=<visitor_token>` (public chatbot visitors)
- `ws://<host>/ws/dashboard/?token=<jwt>&org_id=<org_uuid>` (live org updates)
