$ErrorActionPreference = "Stop"
if (-not (Test-Path "backups")) { New-Item -ItemType Directory -Path "backups" | Out-Null }
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "backups/flowforge_$timestamp.sql"

Write-Host "Backing up PostgreSQL database to $backupFile..." -ForegroundColor Cyan
docker compose exec -T postgres pg_dump -U flowforge_owner -d flowforge --clean --if-exists > $backupFile
Write-Host "Backup saved to $backupFile" -ForegroundColor Green
