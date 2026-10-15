# Builds prelegal, starts it in Docker and waits until it is ready.
# If PowerShell blocks scripts, run: powershell -ExecutionPolicy Bypass -File scripts\start-windows.ps1
#
# Docker writes its progress to stderr, so this script checks exit codes rather than setting
# $ErrorActionPreference = "Stop", which would make Windows PowerShell 5.1 treat that output as an error.

$root = Split-Path -Parent $PSScriptRoot
$compose = Join-Path $root "compose.yaml"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker is not installed. Install Docker Desktop: https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
    exit 1
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker is not running. Open Docker Desktop, wait until it has started, and try again." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $root ".env"))) {
    Write-Host "Note: there is no .env file. Copy .env.example to .env and add your OpenAI API key for the AI features."
}

Write-Host "Building and starting prelegal..."
docker compose -f $compose up --build --detach --wait --wait-timeout 120
if ($LASTEXITCODE -ne 0) {
    Write-Host "prelegal did not start. Recent logs:" -ForegroundColor Red
    docker compose -f $compose logs --tail 50
    exit 1
}
Write-Host "prelegal is running at http://localhost:8000" -ForegroundColor Green
