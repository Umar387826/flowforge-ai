# Next Steps & Continuation Checklist

1. **Pull repository onto your Windows development workstation** with Docker Desktop, Python 3.12+, and Node.js installed.
2. **Configure `.env`**:
   - Copy `.env.example` to `.env`.
   - Set strong random values for `DJANGO_SECRET_KEY` and `TENANT_SIGNING_KEY`.
   - Add test/sandbox credentials for Anthropic, OpenAI, Stripe test mode, Google OAuth 2.0, and HubSpot CRM.
3. **Initialize & Verify Database + Backend**:
   ```powershell
   .\scripts\setup.ps1
   .\scripts\test.ps1
   ```
   Confirm all backend pytest tests (including `test_rls_adversarial.py`, `test_websockets.py`, and `test_billing_quotas.py`) pass against `pgvector/pgvector:pg16` and Redis.
4. **Launch Full Stack**:
   ```powershell
   .\scripts\dev-up.ps1
   ```
   Verify `http://localhost:8080` (Nginx), `http://localhost:8000/api/v1/ready/` (database + pgvector + Redis readiness), and `http://localhost:8000/api/v1/docs/` (Swagger UI).
5. **Run Real Estate End-to-End Flow**:
   - Register an organization -> Create a Knowledge Base -> Upload a PDF property brochure -> Create `Property Assistant` agent -> Chat via WebSocket or Public Widget -> Capture & qualify lead -> Verify HubSpot Contact creation via Workflow Execution.
