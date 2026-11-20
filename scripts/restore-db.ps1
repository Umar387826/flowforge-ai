param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)
$ErrorActionPreference = "Stop"
if (-not (Test-Path $BackupFile)) {
    throw "Backup file not found: $BackupFile"
}
Write-Host "Restoring PostgreSQL database from $BackupFile..." -ForegroundColor Yellow
Get-Content $BackupFile -Raw | docker compose exec -T postgres psql -U flowforge_owner -d flowforge
Write-Host "Database restore completed." -ForegroundColor Green
