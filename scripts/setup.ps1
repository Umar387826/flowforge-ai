$ErrorActionPreference = "Stop"

Write-Host "=== FlowForge AI Setup ===" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example. Update API keys and secrets in .env before production use." -ForegroundColor Yellow
}

if (-not (Test-Path "backend/.venv")) {
    python -m venv backend/.venv
}

& backend/.venv/Scripts/Activate.ps1
pip install --upgrade pip
pip install -r backend/requirements.txt

npm install

Write-Host "Starting PostgreSQL and Redis via Docker Compose..." -ForegroundColor Cyan
docker compose up -d postgres redis

Write-Host "Waiting for PostgreSQL to accept connections..."
Start-Sleep -Seconds 5

$ownerUser = "flowforge_owner"
$ownerPass = "flowforge_owner_dev_pass"
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^POSTGRES_OWNER_USER=(.+)$') { $ownerUser = $matches[1].Trim() }
        if ($_ -match '^POSTGRES_OWNER_PASSWORD=(.+)$') { $ownerPass = $matches[1].Trim() }
    }
}

$env:DJANGO_SETTINGS_MODULE = "config.settings.dev"
$env:POSTGRES_HOST = "localhost"
$env:POSTGRES_APP_USER = $ownerUser
$env:POSTGRES_APP_PASSWORD = $ownerPass

Push-Location backend
python manage.py migrate --noinput
python manage.py sync_tenant_key
python manage.py seed_pakistan_demo
Pop-Location

Write-Host "Setup complete. Run .\scripts\dev-up.ps1 to start all services." -ForegroundColor Green
