#!/usr/bin/env bash
# BigBlueBam deploy/restart helper for Mac + Linux.
#
# Usage:
#   scripts/deploy.sh            # up (build + start, detached) — default
#   scripts/deploy.sh up         # same
#   scripts/deploy.sh restart    # restart running containers (no rebuild)
#   scripts/deploy.sh rebuild    # force-rebuild + recreate everything
#   scripts/deploy.sh stop       # stop without removing containers
#   scripts/deploy.sh down       # stop + remove containers (KEEPS volumes)
#   scripts/deploy.sh logs       # tail logs from all services
#
# If ./site exists (the private marketing site repo is checked out into this
# working tree), the root domain `/` is served from the site service. If not,
# `/` redirects to `/helpdesk/` per the base nginx config.
set -euo pipefail

# cd to repo root (this script lives in scripts/)
cd "$(dirname "${BASH_SOURCE[0]}")/.."

CMD="${1:-up}"
COMPOSE_FILES=(-f docker-compose.yml)

if [[ -d site && -f site/package.json ]]; then
  echo "==> site/ detected — enabling marketing site overlay (root domain → site)"
  COMPOSE_FILES+=(-f docker-compose.site.yml)
else
  echo "==> site/ not present — root domain will redirect to /helpdesk/"
fi

# Prefer `docker compose` (v2 plugin). Fall back to `docker-compose` (v1).
if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
else
  DC=(docker-compose)
fi

case "$CMD" in
  up|deploy)
    "${DC[@]}" "${COMPOSE_FILES[@]}" up -d --build
    ;;
  restart)
    "${DC[@]}" "${COMPOSE_FILES[@]}" restart
    ;;
  rebuild)
    "${DC[@]}" "${COMPOSE_FILES[@]}" up -d --build --force-recreate
    ;;
  stop)
    "${DC[@]}" "${COMPOSE_FILES[@]}" stop
    ;;
  down)
    # NOTE: no `-v` — we never wipe volumes from this script. Data is sacred.
    "${DC[@]}" "${COMPOSE_FILES[@]}" down
    ;;
  logs)
    "${DC[@]}" "${COMPOSE_FILES[@]}" logs -f
    ;;
  ps|status)
    "${DC[@]}" "${COMPOSE_FILES[@]}" ps
    ;;
  *)
    echo "Usage: $0 [up|restart|rebuild|stop|down|logs|ps]" >&2
    exit 1
    ;;
esac
