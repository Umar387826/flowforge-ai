# Local Setup Guide (Windows 11 + PowerShell)

## Prerequisites

- **Python 3.12+**
- **Node.js 22+**
- **Docker Desktop** (with Linux containers enabled)
- **VS Code**

## Automated Setup

```powershell
.\scripts\setup.ps1
```

## Manual Step-by-Step Setup

1. **Create `.env` from template**:
   ```powershell
   Copy-Item .env.example .env
   ```
   Populate `DJANGO_SECRET_KEY`, `TENANT_SIGNING_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and optional `STRIPE_*`, `GOOGLE_OAUTH_*`, and `HUBSPOT_*` credentials.

2. **Start PostgreSQL (pgvector) & Redis**:
   ```powershell
   docker compose up -d postgres redis
   ```

3. **Create Python virtual environment & install backend dependencies**:
   ```powershell
   python -m venv backend\.venv
   .\backend\.venv\Scripts\Activate.ps1
   pip install -r backend\requirements.txt
   ```

4. **Run Migrations & Sync HMAC Tenant Key (as `flowforge_owner`)**:
   ```powershell
   cd backend
   $env:POSTGRES_HOST="localhost"
   $env:POSTGRES_APP_USER="flowforge_owner"
   $env:POSTGRES_APP_PASSWORD="flowforge_owner_dev_pass"
   python manage.py migrate
   python manage.py sync_tenant_key
   python manage.py createsuperuser
   ```

5. **Run Backend ASGI Server, Celery Worker & Celery Beat** (using runtime role `flowforge_app`):
   ```powershell
   # Terminal 1: Daphne ASGI
   daphne -b 0.0.0.0 -p 8000 config.asgi:application

   # Terminal 2: Celery Worker
   celery -A config worker -l INFO -Q default,documents,workflows,integrations

   # Terminal 3: Celery Beat
   celery -A config beat -l INFO --scheduler django_celery_beat.schedulers:DatabaseScheduler
   ```

6. **Run Frontend Dev Server**:
   ```powershell
   npm install
   npm run dev
   ```
   Access Vite frontend at `http://localhost:3000`.
