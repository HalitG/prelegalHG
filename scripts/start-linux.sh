#!/usr/bin/env bash
# Builds prelegal, starts it in Docker and waits until it is ready.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed. See https://docs.docker.com/engine/install/" >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running, or you don't have permission to use it." >&2
  echo "Start it with 'sudo systemctl start docker', or add yourself to the docker group." >&2
  exit 1
fi
if [ ! -f .env ]; then
  echo "Note: there is no .env file. Create one containing OPENAI_API_KEY=<your key> for the AI features."
fi

echo "Building and starting prelegal..."
if ! docker compose up --build --detach --wait --wait-timeout 120; then
  echo "prelegal did not start. Recent logs:" >&2
  docker compose logs --tail 50 >&2 || true
  exit 1
fi
echo "prelegal is running at http://localhost:8000"
