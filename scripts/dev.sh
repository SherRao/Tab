#!/usr/bin/env bash
set -e

COMPOSE_FILE="$(dirname "$0")/../docker-compose.yml"

cleanup() {
  echo ""
  echo "Stopping database..."
  docker compose -f "$COMPOSE_FILE" down
}
trap cleanup EXIT

if [ -z "$POSTGRES_URL" ]; then
  export POSTGRES_URL="postgresql://tab:tab@localhost:5432/tab"
fi

echo "Starting database..."
docker compose -f "$COMPOSE_FILE" up -d --wait

echo "Running migrations..."
npx tsx src/db/migrate.ts

echo "Starting dev server..."
npx next dev "$@"
