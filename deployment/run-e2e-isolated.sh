#!/bin/bash
# ============================================================
# Isolated E2E test run — fresh backend + frontend stack per
# invocation, torn down (containers AND volumes) on exit no
# matter how the run ends. Prod is never touched: this spins up
# its own Postgres, its own Supabase services, its own 4 app
# containers, all on host-local ports, and runs the exact same
# Playwright spec files against those instead of greyin.net.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { echo -e "${BLUE}==>${NC} $1"; }
ok()   { echo -e "${GREEN}OK${NC} $1"; }
fail() { echo -e "${RED}FAIL${NC} $1"; }

NODE_MAJOR=$(node -e 'console.log(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Playwright requires Node.js 20+, found $(node -v 2>/dev/null || echo 'no node on PATH')." >&2
  echo "Point PATH at a Node 20+ install before running this script." >&2
  exit 1
fi

set -a
source .env
set +a

export E2E_DB_PORT="${E2E_DB_PORT:-54329}"
export E2E_KONG_PORT="${E2E_KONG_PORT:-8180}"
export E2E_DEEPEDGE_PORT="${E2E_DEEPEDGE_PORT:-3100}"
export E2E_GREYMATTERS_PORT="${E2E_GREYMATTERS_PORT:-3101}"
export E2E_FLEXPRO_PORT="${E2E_FLEXPRO_PORT:-3102}"
export E2E_SALTNPEPPER_PORT="${E2E_SALTNPEPPER_PORT:-3103}"
export E2E_SITE_URL="http://localhost:${E2E_DEEPEDGE_PORT}"
export E2E_REDIRECT_URLS="http://localhost:${E2E_GREYMATTERS_PORT},http://localhost:${E2E_FLEXPRO_PORT},http://localhost:${E2E_SALTNPEPPER_PORT}"

# .env sets COMPOSE_PROJECT_NAME=greyin for the (unrelated, swarm-deployed)
# prod stack's own reference — pin an explicit, distinct project name here
# so this never ambiguously shares a Compose project/network with anything
# else, regardless of what's sourced from .env.
export COMPOSE_PROJECT_NAME=greyin-e2e
BACKEND_COMPOSE="docker compose -p greyin-e2e -f docker-compose.e2e.yml"
FRONTEND_COMPOSE="docker compose -p greyin-e2e -f docker-compose.e2e-frontend.yml"

cleanup() {
  info "Tearing down isolated e2e stack (containers + volumes)..."
  $FRONTEND_COMPOSE down --remove-orphans 2>&1 | tail -5 || true
  $BACKEND_COMPOSE down -v --remove-orphans 2>&1 | tail -5 || true
  ok "Isolated stack removed — nothing left behind, prod untouched."
}
trap cleanup EXIT

info "Starting isolated Supabase backend (fresh Postgres + auth + rest + storage)..."
$BACKEND_COMPOSE up -d

info "Waiting for Postgres to be ready..."
until docker exec "$($BACKEND_COMPOSE ps -q db)" pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
done
# supabase/postgres does an internal restart shortly after its own init
# scripts finish, in the narrow window right after pg_isready first
# succeeds (see the comment on the `auth`/`storage` services' restart
# policy) — a short settle delay here means migrations don't race it too.
sleep 3
ok "Postgres ready"

info "Applying migrations..."
DB_CONTAINER=$($BACKEND_COMPOSE ps -q db)
for f in migrations/*.sql; do
  echo "  - $(basename "$f")"
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f" > /dev/null
done
ok "Schema applied ($(ls migrations/*.sql | wc -l) migrations)"

info "Restarting PostgREST so it picks up the fresh schema..."
$BACKEND_COMPOSE restart rest > /dev/null
sleep 2

info "Waiting for the API gateway to answer..."
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${E2E_KONG_PORT}/rest/v1/" -H "apikey: ${ANON_KEY}" >/dev/null 2>&1; then
    ok "Kong/PostgREST reachable on :${E2E_KONG_PORT}"
    break
  fi
  sleep 1
done

info "Building and starting the 4 frontend apps against the isolated backend..."
$FRONTEND_COMPOSE up -d --build

info "Waiting for all 4 apps to respond..."
for port in "$E2E_DEEPEDGE_PORT" "$E2E_GREYMATTERS_PORT" "$E2E_FLEXPRO_PORT" "$E2E_SALTNPEPPER_PORT"; do
  for i in $(seq 1 60); do
    if curl -sf "http://localhost:${port}/" >/dev/null 2>&1; then
      ok "App on :${port} is up"
      break
    fi
    sleep 1
    if [ "$i" -eq 60 ]; then
      fail "App on :${port} never came up — dumping logs"
      $FRONTEND_COMPOSE logs --tail 50
      exit 1
    fi
  done
done

info "Running Playwright against the isolated stack..."
cd ../e2e
export E2E_TARGET=local
export SUPABASE_URL="http://localhost:${E2E_KONG_PORT}"
export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}"
export E2E_DEEPEDGE_PORT E2E_GREYMATTERS_PORT E2E_FLEXPRO_PORT E2E_SALTNPEPPER_PORT

# This is a handful of lightweight single-replica containers on one host,
# not prod's dedicated stack — Playwright's default worker count (one per
# CPU core) was enough parallel signups at once to blow past GoTrue's
# request rate limiting. --workers=8 is the default here; pass your own
# -- --workers=N (or anything else) via "$@" to override.
if [[ "$*" != *"--workers"* ]]; then
  set -- --workers=8 "$@"
fi
npx playwright test "$@"
