$ErrorActionPreference = "Stop"

Write-Host "=== Running Frontend TypeScript, Vitest & Build ===" -ForegroundColor Cyan
npm run lint
npx vitest run
npm run build

Write-Host "=== Running Backend Django Checks & Pytest Suite ===" -ForegroundColor Cyan
docker compose up -d postgres redis
Start-Sleep -Seconds 3

$env:POSTGRES_HOST = "localhost"
$env:REDIS_URL = "redis://localhost:6379/0"
$env:CELERY_BROKER_URL = "redis://localhost:6379/1"
$env:CHANNEL_LAYER_REDIS_URL = "redis://localhost:6379/3"
$env:DJANGO_SETTINGS_MODULE = "config.settings.test"

Push-Location backend
if (Test-Path ".venv/Scripts/python.exe") {
    & .venv/Scripts/python.exe manage.py check
    & .venv/Scripts/pytest.exe
} else {
    python manage.py check
    pytest
}
Pop-Location
