# Testing Guide

## Test Suites

### 1. Frontend Tests (Vitest + React Testing Library + TypeScript)
- `src/__tests__/apiClient.test.ts`: JWT injection, `X-Organization-ID` header, 401 refresh rotation, error envelope parsing.
- `src/__tests__/authForms.test.tsx`: Login/Register validation, protected route redirects.
- `src/__tests__/dashboardComponents.test.tsx`: All 14 dashboard sections navigation, `AgentsSection` integration.

Run locally:
```powershell
npm run lint
npx vitest run
npm run build
```

### 2. Backend & Security Tests (`backend/tests/` via Pytest)
- `test_auth_and_orgs.py`: Registration, cross-org API isolation (`403`/`404`), RBAC enforcement.
- `test_rls_adversarial.py`: Signed token tamper/expiry verification, cross-tenant `SELECT`/`INSERT`/`UPDATE`/`DELETE` blocks, forged GUC rejection, `security.tenant_signing_keys` privilege denial.
- `test_websockets.py`: Async Channels auth, cross-tenant WS rejection, unauthenticated rejection, concurrent tab messaging.
- `test_celery_documents.py`: Tenant mismatch rejection, transient failure retry, idempotent chunk deduplication.
- `test_rag_and_agents.py`: Prompt-injection sanitization, citation formatting, empty-knowledge fallback.
- `test_workflows_and_integrations.py`: `AND`/`OR` conditions, HMAC webhook signature & replay protection, AI qualification + HubSpot sync flow.
- `test_billing_quotas.py`: Free tier quota block (`402`), Stripe webhook idempotency, Pro tier entitlement unlock.

Run locally against Docker Postgres + Redis:
```powershell
.\scripts\test.ps1
```
