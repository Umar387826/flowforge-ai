# Deployment & Operations Guide

## Production Docker Stack

`docker-compose.yml` orchestrates:
- `postgres`: `pgvector/pgvector:pg16` initialized with `infra/postgres/init.sql`
- `redis`: `redis:7-alpine` (cache, Channels layer, Celery broker/result backend)
- `backend-migrate`: One-shot migration + `sync_tenant_key` + `collectstatic` job running as `flowforge_owner`
- `backend`: Daphne ASGI server on port `8000` running as `flowforge_app` (`config.settings.prod`, `DEBUG=False`)
- `celery-worker`: Multi-queue worker (`default,documents,workflows,integrations`)
- `celery-beat`: Database-backed periodic scheduler (`django_celery_beat`)
- `frontend`: Multi-stage Node 22 build served by Nginx
- `nginx`: Edge reverse proxy on port `8080` with WebSocket upgrade, API rate limiting (`30r/s`), and security headers

## Starting Production-Like Environment

```powershell
Copy-Item .env.example .env
# Edit .env with strong production secrets and set DJANGO_DEBUG=False
docker compose up -d --build
```

## Backup & Restore

```powershell
# Create timestamped SQL dump in ./backups/
.\scripts\backup-db.ps1

# Restore from backup file
.\scripts\restore-db.ps1 -BackupFile backups\flowforge_20261118_120000.sql
```

## Health & Readiness

- Liveness: `GET /api/v1/health/`
- Readiness (verifies PostgreSQL, `pgvector` extension, and Redis `PING`): `GET /api/v1/ready/`
