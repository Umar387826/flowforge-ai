# FlowForge AI
### Multi-Tenant AI Automation SaaS Platform

FlowForge AI is a modular, multi-tenant SaaS platform designed to automate business workflows using AI agents, document intelligence, real-time conversations, third-party integrations, and subscription-based billing.

The platform is built using Django, Django REST Framework, React, PostgreSQL, Redis, Celery, and Docker.

---

## 1. Project Overview

FlowForge AI provides organizations with an AI-powered workspace to:

- Create and manage AI agents.
- Upload and process business documents.
- Retrieve knowledge from documents using RAG.
- Communicate through real-time AI chat.
- Build trigger-based automation workflows.
- Integrate external CRM and business services.
- Manage subscriptions, billing, and usage quotas.
- Maintain organization-level data isolation and security.

**Architecture:** Modular Monolith  
**Deployment:** Docker-based multi-service architecture

---

## 2. Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Python, Django 5, Django REST Framework |
| Authentication | JWT, organization membership, RBAC |
| Database | PostgreSQL |
| Vector Search | pgvector, embeddings |
| Tenant Security | PostgreSQL RLS, HMAC-SHA256 |
| Real-Time | Django Channels, ASGI, WebSockets |
| Background Jobs | Celery, Redis, Celery Beat |
| AI | Anthropic Claude, OpenAI embeddings |
| Integrations | Google OAuth 2.0, HubSpot, Webhooks |
| Billing | Stripe |
| Infrastructure | Docker, Docker Compose, Nginx |
| Testing | Django Test Framework, Vitest |

---

## 3. System Architecture

The application follows a modular architecture:

- React frontend communicates with Django REST APIs.
- Django handles authentication, business logic, and tenant authorization.
- PostgreSQL stores application and organization data.
- PostgreSQL RLS enforces tenant-level database isolation.
- Redis supports background processing and real-time communication.
- Celery workers execute asynchronous tasks.
- Celery Beat schedules recurring jobs.
- Django Channels handles WebSocket connections.
- Nginx serves and routes application traffic.

### Main Backend Modules

- Accounts
- Organizations
- Agents
- Conversations
- Documents
- Knowledge
- Workflows
- Integrations
- Leads
- Billing
- Audit
- Notifications

---

## 4. Core Security Architecture

Security is a core part of FlowForge AI.

### Multi-Tenant Isolation

- Organization-based data ownership.
- Role-based access control.
- PostgreSQL Row-Level Security.
- ENABLE ROW LEVEL SECURITY and FORCE ROW LEVEL SECURITY.
- HMAC-SHA256 signed tenant context.
- Transaction-scoped tenant authorization.
- PostgreSQL SECURITY DEFINER helper functions.
- Separate runtime application and database owner roles.
- Least-privilege application database access.

The runtime application role is `flowforge_app`.

Tenant context is verified inside PostgreSQL rather than relying only on frontend-supplied organization identifiers.

### Additional Security

- JWT authentication.
- Protected API endpoints.
- WebSocket connection authorization.
- Signed webhook verification.
- Webhook replay protection.
- Secret management through environment variables.
- Audit logging.

---

## 5. Project Milestones

The project follows eight major implementation milestones.

### Milestone 1 — React + Django Integration

- React and TypeScript dashboard.
- Django REST Framework APIs.
- JWT authentication.
- Protected routes.
- CORS and CSRF configuration.
- API client integration.
- Organization dashboard and workspace structure.

**Acceptance goal:** Users can authenticate and access their organization dashboard.

### Milestone 2 — Real-Time Chat

- Django Channels and ASGI.
- Redis channel layer.
- Authenticated WebSocket connections.
- Tenant-aware conversation authorization.
- AI response streaming.
- Reconnection support.

**Acceptance goal:** Multiple authorized users can communicate through real-time conversations.

### Milestone 3 — Celery + Redis Background Jobs

- Celery worker and Beat.
- Dedicated task queues.
- Retry and exponential backoff.
- Task failure handling.
- Idempotent processing.
- Background document processing.

**Acceptance goal:** Uploaded documents can be processed asynchronously with recoverable task failures.

### Milestone 4 — AI Agents + RAG

- AI agent integration.
- LLM tool calling.
- Structured outputs.
- Document ingestion and chunking.
- Text embeddings.
- PostgreSQL pgvector similarity search.
- Source citations.
- Prompt-injection protection.

**Acceptance goal:** AI answers questions using uploaded documents with supporting sources.

### Milestone 5 — Automation + Integrations

- Trigger-condition-action workflow engine.
- Workflow execution history.
- AI lead qualification.
- Google OAuth 2.0.
- HubSpot CRM integration.
- Signed webhooks.
- External service synchronization.

**Acceptance goal:** A captured lead can be qualified by AI and synchronized with a CRM.

### Milestone 6 — SaaS Billing

- Stripe Checkout.
- Subscription management.
- Billing Portal.
- Webhook signature verification.
- Idempotent billing events.
- Usage metering.
- Free, Pro, and Business plans.
- Backend-enforced quotas.

**Acceptance goal:** Free-plan quotas are enforced and paid subscription upgrades can be processed.

### Milestone 7 — DevOps

- Docker Compose services.
- Nginx application routing.
- Backend and frontend containers.
- Redis and PostgreSQL services.
- Celery worker and Beat.
- Health checks.
- Environment-based configuration.
- CI/CD and deployment preparation.

**Acceptance goal:** The application can be deployed in a fresh environment with automated checks.

### Milestone 8 — Production Security + Quality

- Unit and integration tests.
- Tenant isolation testing.
- WebSocket security testing.
- RAG security testing.
- Billing edge-case testing.
- Retry and concurrency testing.
- Logging and monitoring.
- Backup and restore validation.

**Acceptance goal:** Cross-tenant access is blocked and critical application operations behave safely under failure.

---

## 6. AI and Document Processing

The document-processing pipeline uses background workers:

1. User uploads a document.
2. Backend validates and stores the document.
3. Celery schedules asynchronous processing.
4. Text is extracted and divided into chunks.
5. Embeddings are generated.
6. Document chunks are stored in PostgreSQL with vector representations.
7. RAG retrieves relevant content for AI responses.
8. Responses can include supporting source references.

Configured embedding model: `text-embedding-3-small`  
Embedding dimensions: `1536`

**External dependency:** Live OpenAI embedding and end-to-end RAG acceptance testing requires an available OpenAI API quota.

---

## 7. Workflow Automation and Integrations

The workflow engine supports trigger-condition-action execution.

Example business workflow:

`Lead Capture → AI Qualification → CRM Synchronization`

Integration capabilities include:

- Google OAuth 2.0.
- HubSpot CRM.
- Signed webhooks.
- Token refresh handling.
- Workflow execution history.
- Integration synchronization logs.

---

## 8. SaaS Billing and Usage Management

The billing module supports:

- Free, Pro, and Business plan structures.
- Stripe Checkout integration.
- Stripe Billing Portal.
- Subscription lifecycle handling.
- Webhook verification.
- Idempotent billing event processing.
- Backend-enforced usage quotas.

Stripe configuration must use valid credentials and configured price IDs.

---

## 9. Repository Structure

```text
flowforge/
├── .github/              # GitHub workflows
├── backend/              # Django backend
│   ├── apps/
│   │   ├── accounts/
│   │   ├── agents/
│   │   ├── audit/
│   │   ├── billing/
│   │   ├── common/
│   │   ├── conversations/
│   │   ├── documents/
│   │   ├── integrations/
│   │   ├── knowledge/
│   │   ├── leads/
│   │   ├── notifications/
│   │   ├── organizations/
│   │   └── workflows/
│   └── manage.py
├── docs/                 # Project documentation
├── infra/                # Infrastructure configuration
├── scripts/              # Setup and development scripts
├── src/                  # React frontend
├── docker-compose.yml
├── package.json
├── README.md
└── vite.config.ts
```

---

## 10. Installation and Setup

### Prerequisites

- Windows, Linux, or macOS.
- Python 3.12.
- Node.js and npm.
- Docker Desktop or Docker Engine.
- Docker Compose.
- Git.

### Windows PowerShell Setup

Clone the repository:

```powershell
git clone <GITHUB_REPOSITORY_URL>
cd flowforge
```

Create the environment configuration:

```powershell
Copy-Item .env.example .env
```

Configure the required environment variables in `.env`.

Do not commit `.env` or publish API keys, passwords, signing keys, or other credentials.

Run the setup script:

```powershell
.\scripts\setup.ps1
```

Start the application:

```powershell
.\scripts\dev-up.ps1
```

### Local Application URLs

| Service | URL |
|---|---|
| Web Dashboard | http://localhost:8080 |
| Backend Health | http://localhost:8000/api/v1/health/ |
| Swagger / OpenAPI | http://localhost:8000/api/v1/docs/ |

---

## 11. Database Migrations

Run Django migrations:

```powershell
docker exec flowforge_backend python manage.py migrate
```

Check migration consistency:

```powershell
docker exec flowforge_backend python manage.py makemigrations --check --dry-run
```

Run Django system checks:

```powershell
docker exec flowforge_backend python manage.py check
```

---

## 12. Testing

Run the selected backend test suites:

```powershell
docker exec flowforge_backend python manage.py test apps.workflows.tests apps.integrations.tests apps.billing.tests apps.knowledge.tests apps.documents.tests apps.conversations.tests
```

Run frontend production build:

```powershell
npm run build
```

Run frontend tests where configured:

```powershell
npm run test
```

The selected backend test suites have passed 29 tests in the current local verification.

Passing selected tests does not imply that every production acceptance scenario has been validated.

---

## 13. Current Verification and Known Limitations

The following checks have passed in the current local development environment:

- Django system check.
- Database migration synchronization.
- No pending model migration changes.
- 29 selected backend tests.
- React/Vite production build.
- PostgreSQL health.
- Backend API health.
- Frontend HTTP response.
- Redis and Celery services running.

The following acceptance activities still require further verification:

- Live OpenAI embedding and grounded RAG testing after API quota is available.
- Comprehensive multi-user WebSocket delivery and reconnect testing.
- Full CI/CD execution and production deployment validation.
- Backup and restore acceptance testing.
- Comprehensive cross-tenant security and concurrency testing.

These are outstanding verification activities, not claims of completed production certification.

---

## 14. Environment Variables and Secrets

Use `.env.example` as the configuration template.

Important configuration categories:

- Django application settings.
- PostgreSQL credentials.
- Tenant signing key.
- Redis and Celery URLs.
- Anthropic and OpenAI API credentials.
- Google OAuth credentials.
- HubSpot credentials.
- Stripe credentials.
- Frontend API and WebSocket URLs.

Never commit the actual `.env` file.

---

## 15. Project Objective

The objective of FlowForge AI is to provide a secure, scalable, organization-aware AI automation platform that combines conversational AI, document intelligence, business workflow automation, third-party integrations, and subscription-based SaaS services.

The project is designed around modular development, tenant isolation, asynchronous processing, and production-oriented security practices.

---

**Project:** FlowForge AI  
**Category:** Multi-Tenant AI Automation SaaS  
**Backend:** Django + Django REST Framework  
**Frontend:** React + TypeScript  
**Database:** PostgreSQL + pgvector  
**Background Processing:** Celery + Redis  
**Real-Time:** Django Channels + WebSockets  
**Infrastructure:** Docker Compose + Nginx
