#!/bin/sh
#
# Runtime nginx profile selector for the BigBlueBam frontend image.
#
# The official nginx:alpine base image runs every executable file in
# /docker-entrypoint.d/ before starting nginx, so dropping this script
# there lets us pick the right nginx config at container start rather
# than at build time. That matters because Railway's public GraphQL API
# does NOT expose buildArgs on serviceInstanceUpdate, so we need a
# single image that works for docker-compose, bare docker, AND Railway.
#
# Both profiles are baked into the image under /etc/nginx/profiles/:
#   default.conf → infra/nginx/nginx.conf         (docker-compose / bare docker)
#   railway.conf → infra/nginx/nginx.railway.conf (uses *.railway.internal upstreams)
#
# Selection rule: if Railway-injected env vars are present, use railway;
# otherwise use default. The compose flow continues to override the
# selected profile because docker-compose.yml bind-mounts
# infra/nginx/nginx-with-site.conf over /etc/nginx/conf.d/default.conf
# at runtime.
#
# This script MUST be POSIX /bin/sh (not bash) — the nginx:alpine image
# only ships BusyBox sh.

set -e

if [ -n "${RAILWAY_ENVIRONMENT_NAME:-}" ] || [ -n "${RAILWAY_PROJECT_ID:-}" ]; then
  cp /etc/nginx/profiles/railway.conf /etc/nginx/conf.d/default.conf
  echo "[entrypoint] using nginx profile: railway"
else
  cp /etc/nginx/profiles/default.conf /etc/nginx/conf.d/default.conf
  echo "[entrypoint] using nginx profile: default"
fi

exit 0
