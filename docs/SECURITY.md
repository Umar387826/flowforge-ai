# Security & Multi-Tenant Isolation

## 1. Cryptographic PostgreSQL Row-Level Security (RLS)

FlowForge AI does **not** rely on ordinary unsigned session GUCs such as `SET app.org_id = '...'`.

1. **Separated Database Roles**:
   - `flowforge_owner`: Used exclusively during `manage.py migrate` and `manage.py sync_tenant_key`.
   - `flowforge_app`: Runtime role used by Daphne, Gunicorn, and Celery (`NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`).
2. **Inaccessible Signing Key**:
   - `TENANT_SIGNING_KEY` is stored in `security.tenant_signing_keys` inside the `security` schema. `flowforge_app` has **zero** privileges on `security` or `security.tenant_signing_keys`.
3. **Transaction-Scoped Signed Context (`SET LOCAL`)**:
   - Every DRF tenant view (`TenantScopedMixin`), Celery task, and Channels DB call enters `with tenant_context(org_id, actor_id):`.
   - Python generates `<org_uuid>:<actor_uuid>:<exp_unix_ts>:<nonce>:<hmac_sha256>` (default TTL 30s) and sets `SELECT set_config('app.tenant_token', token, true)` inside `transaction.atomic()`.
   - Because `is_local=true`, PostgreSQL clears the token automatically at transaction `COMMIT`/`ROLLBACK`—preventing connection-pool leakage.
4. **Database-Boundary Verification**:
   - `public.verify_tenant_token()` is a `SECURITY DEFINER` function that checks token structure, UUID syntax, expiration window (`clock_timestamp()`), and `pgcrypto` HMAC-SHA256 equality against `security.tenant_signing_keys`.
   - All tenant tables enforce `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` with `USING (organization_id = public.current_tenant_id()) WITH CHECK (organization_id = public.current_tenant_id())`.
   - Missing, expired, malformed, or forged tokens evaluate to `NULL`, blocking all cross-tenant `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.

## 2. WebSocket, RAG, Webhook & Billing Safeguards

- **WebSockets**: Client-supplied org IDs are ignored; `ChatConsumer` verifies `OrganizationMembership` or exact `visitor_session_token` bound to `Conversation.organization_id`.
- **RAG & Prompt Injection**: `retrieve_relevant_chunks` enforces both active RLS and explicit `organization_id` filters, sanitizes embedded prompt-injection directives, and instructs the LLM never to fabricate facts when no chunks match.
- **Webhooks**: `InboundWebhookReceiveView` validates `X-FlowForge-Signature` (HMAC-SHA256), rejects timestamps older than 300s (`X-FlowForge-Timestamp`), and enforces unique `(endpoint, event_id)` replay protection.
- **Billing**: Quotas are enforced server-side via `enforce_quota()`. Stripe webhooks verify `Stripe-Signature` and persist `StripeWebhookEvent.stripe_event_id` for idempotency.
