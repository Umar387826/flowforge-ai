$ErrorActionPreference = "Stop"
Write-Host "Stopping FlowForge AI services..." -ForegroundColor Yellow
docker compose down
