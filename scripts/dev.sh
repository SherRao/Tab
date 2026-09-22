#!/usr/bin/env bash
set -e

COMPOSE_FILE="$(dirname "$0")/../docker-compose.yml"

cleanup() {
  echo ""
  echo "Stopping database..."
  docker compose -f "$COMPOSE_FILE" down
}
trap cleanup EXIT

if ! docker info &>/dev/null; then
  echo "Docker is not running. Starting Docker Desktop..."
  open -a Docker
  until docker info &>/dev/null; do
    sleep 1
  done
  echo "Docker is ready."
fi

if [ -z "$POSTGRES_URL" ]; then
  export POSTGRES_URL="postgresql://tab:tab@localhost:5432/tab"
fi

echo "Starting database..."
docker compose -f "$COMPOSE_FILE" up -d --wait

echo "Running migrations..."
npx tsx src/db/migrate.ts

echo "Starting dev server..."
npx next dev "$@"
