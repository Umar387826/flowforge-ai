$ErrorActionPreference = "Stop"
Write-Host "Starting FlowForge AI full stack via Docker Compose..." -ForegroundColor Cyan
docker compose up -d --build
Write-Host "Services running! Open http://localhost:8080 (Nginx) or http://localhost:8000/api/v1/docs/ (Swagger)." -ForegroundColor Green
