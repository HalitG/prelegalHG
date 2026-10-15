# Stops prelegal and removes its container. The database is temporary, so its data is discarded.
# If PowerShell blocks scripts, run: powershell -ExecutionPolicy Bypass -File scripts\stop-windows.ps1

$compose = Join-Path (Split-Path -Parent $PSScriptRoot) "compose.yaml"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker is not installed, so prelegal is not running." -ForegroundColor Red
    exit 1
}
docker compose -f $compose down
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
Write-Host "prelegal is stopped."
