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
  PROFILE=railway
else
  PROFILE=default
fi

# Try to install the chosen profile. If docker-compose.yml has bind-mounted
# nginx-with-site.conf as :ro over /etc/nginx/conf.d/default.conf, the cp
# will fail because the destination is on a read-only mount — and that's
# intentional. The bind-mounted file IS the active config for the compose
# flow, so we leave it alone and let nginx start with whatever's there.
if cp "/etc/nginx/profiles/${PROFILE}.conf" /etc/nginx/conf.d/default.conf 2>/dev/null; then
  echo "[entrypoint] using nginx profile: ${PROFILE}"

  # The railway profile ships with a `resolver __RESOLVER__ valid=10s;`
  # placeholder so nginx can re-resolve *.railway.internal hostnames at
  # request time (see scripts/gen-railway-configs.mjs for the why).
  # Extract the nameservers from the container's /etc/resolv.conf and
  # substitute them in. Fall back to Docker's embedded DNS (127.0.0.11)
  # so the config is still syntactically valid if /etc/resolv.conf is
  # unexpectedly empty — nginx would refuse to start with a literal
  # `__RESOLVER__` token otherwise.
  if grep -q '__RESOLVER__' /etc/nginx/conf.d/default.conf; then
    # nginx's resolver directive requires IPv6 addresses to be wrapped in
    # brackets (resolver [fd12::10] valid=10s;), otherwise it parses the
    # final "::10" as a :port specifier and emits "invalid port" at startup.
    # Railway's container DNS is IPv6 (fd12::10 on the railway-internal
    # network), so this wrapping is the common case there.
    RESOLVERS=$(awk '
      /^nameserver/ {
        ip = $2
        if (index(ip, ":") > 0) ip = "[" ip "]"
        printf "%s ", ip
      }
    ' /etc/resolv.conf | sed 's/ $//')
    if [ -z "$RESOLVERS" ]; then
      RESOLVERS="127.0.0.11"
    fi
    sed -i "s|__RESOLVER__|${RESOLVERS}|g" /etc/nginx/conf.d/default.conf
    echo "[entrypoint] nginx resolver set to: ${RESOLVERS}"
  fi
else
  echo "[entrypoint] /etc/nginx/conf.d/default.conf is read-only — using bind-mounted config instead"
fi

exit 0
