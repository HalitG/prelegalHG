#!/usr/bin/env bash
# Stops prelegal and removes its container. The database is temporary, so its data is discarded.
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose down
echo "prelegal is stopped."
