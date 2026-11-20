# Architecture Overview

FlowForge AI follows a **modular monolith** architecture split into focused Django apps and a React/TypeScript SPA.

## Backend Modular Monolith (`backend/apps/`)

| App | Responsibility |
| --- | --- |
| `common` | Base UUID/timestamp/soft-delete models, HMAC tenant context (`tenancy.py`), DRF `TenantScopedMixin`, RBAC permissions, PostgreSQL RLS DDL (`rls.py`), correlation IDs, health/readiness endpoints |
| `accounts` | Custom UUID email `User`, JWT register/login/logout/refresh, password reset tokens, email verification |
| `organizations` | `Organization`, `OrganizationMembership` (`owner`/`admin`/`manager`/`member`), `OrganizationInvitation`, Celery Beat expiration cleanup |
| `agents` | `AIAgent` configuration, `LLMProvider` abstraction (`AnthropicLLMProvider`, `OpenAILLMProvider`), streaming, tool calling |
| `knowledge` | `KnowledgeBase`, `DocumentChunk` (`pgvector` `VectorField(1536)` + `HnswIndex`), `OpenAIEmbeddingProvider`, tenant-scoped RAG retrieval & prompt-injection sanitizer |
| `documents` | `Document` uploads, SHA-256 checksums, Celery `process_document_task` (`pypdf` extraction, chunking, batch embeddings) |
| `conversations` | `Conversation`, `Message`, Channels `JWTAndWidgetAuthMiddleware`, `ChatConsumer`, `DashboardConsumer`, public widget API |
| `leads` | `Lead` model, Anthropic structured-output AI qualification (`qualify_lead_with_ai`), CRM sync triggers |
| `workflows` | `Workflow`, `WorkflowExecution`, `TRIGGER → CONDITION → ACTION` evaluator & idempotent Celery task runner |
| `integrations` | Google OAuth 2.0 (`google_oauth.py`), HubSpot CRM v3 (`hubspot.py`), HMAC-signed webhooks with replay protection (`webhooks.py`), `SyncLog` |
| `billing` | `Subscription`, `UsageRecord`, `StripeWebhookEvent`, `InvoiceHistory`, strict server-side `enforce_quota()` |
| `analytics` | Aggregated organization KPIs and metered usage reporting |
| `audit` | Immutable `AuditLog` with actor, resource, IP, and request correlation ID |
| `notifications` | Organization and user notifications |

## Frontend Modules (`src/`)

- `src/api/client.ts`: Fetch client with automatic `Authorization: Bearer` + `X-Organization-ID` injection and 401 refresh rotation.
- `src/api/ws.ts`: Auto-reconnecting Django Channels WebSocket client with streaming token assembly.
- `src/context/AuthContext.tsx`: Session state, active organization switching, and Light/Dark theme state.
- `src/pages/dashboard/`: All 14 operational sections (`Overview`, `AI Agents`, `Knowledge Bases`, `Documents`, `Conversations`, `Chatbot Deployment`, `Leads`, `Workflows`, `Integrations`, `Usage Analytics`, `Billing`, `Organization Members`, `Settings`, `Audit History`).
