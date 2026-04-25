#!/bin/sh
#
# Runtime nginx profile selector + TLS template renderer for the
# BigBlueBam frontend image.
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
# otherwise use default. The compose flow ALSO bind-mounts
# infra/nginx/nginx-with-site.conf at /etc/nginx/templates/site.conf.template
# (read-only); when present this script copies it over the chosen profile
# and applies the TLS / HTTP-mode substitutions described below.
#
# TLS substitutions (docker-compose only — Railway terminates TLS upstream):
#   - If /etc/nginx/certs/local.crt exists, the __TLS_LISTEN_BLOCK__
#     placeholder in the active config is replaced with `listen 443 ssl;
#     ssl_certificate ...; ssl_certificate_key ...;` plus an HSTS header
#     whose max-age is conservative (300) for self-signed/mkcert and long
#     (31536000) for LE. Otherwise the placeholder is removed.
#   - The __HTTP_LISTEN__ placeholder is `listen 80;` for TLS_HTTP_MODE=
#     "none" (no TLS) or "both", and empty for "redirect" or "https-only"
#     (in those modes a separate /etc/nginx/conf.d/00-tls-redirect.conf
#     becomes the sole port-80 listener).
#   - When TLS_HTTP_MODE is redirect or https-only, the
#     /etc/nginx/templates/tls-redirect.conf.template file is rendered
#     into /etc/nginx/conf.d/00-tls-redirect.conf with __TLS_RETURN__
#     and __EXT_HTTPS_PORT__ substituted.
#
# This script MUST be POSIX /bin/sh (not bash) — the nginx:alpine image
# only ships BusyBox sh.

set -e

if [ -n "${RAILWAY_ENVIRONMENT_NAME:-}" ] || [ -n "${RAILWAY_PROJECT_ID:-}" ]; then
  PROFILE=railway
else
  PROFILE=default
fi

ACTIVE_CONF="/etc/nginx/conf.d/default.conf"
SITE_TEMPLATE="/etc/nginx/templates/site.conf.template"
TLS_REDIRECT_TEMPLATE="/etc/nginx/templates/tls-redirect.conf.template"
TLS_REDIRECT_OUT="/etc/nginx/conf.d/00-tls-redirect.conf"
CERT_FILE="/etc/nginx/certs/local.crt"
KEY_FILE="/etc/nginx/certs/local.key"

# Step 1: pick the right base config.
#
# Compose flow: bind mounts the site template at SITE_TEMPLATE (read-only).
# We copy it over the active path so we can sed-edit it for TLS without
# touching the read-only mount. This is a behavior change from the prior
# "bind directly over default.conf" pattern, and is required so the TLS
# placeholders can be substituted at boot. The compose adapter has been
# updated accordingly — see docker-compose.yml frontend service mounts.
if [ -r "$SITE_TEMPLATE" ]; then
  cp "$SITE_TEMPLATE" "$ACTIVE_CONF"
  echo "[entrypoint] using bind-mounted site template for nginx config"
elif cp "/etc/nginx/profiles/${PROFILE}.conf" "$ACTIVE_CONF" 2>/dev/null; then
  echo "[entrypoint] using nginx profile: ${PROFILE}"
else
  echo "[entrypoint] /etc/nginx/conf.d/default.conf is read-only — using bind-mounted config instead"
fi

# Step 2: railway resolver substitution (unchanged).
#
# The railway profile ships with a `resolver __RESOLVER__ valid=10s;`
# placeholder so nginx can re-resolve *.railway.internal hostnames at
# request time. Extract nameservers from /etc/resolv.conf and substitute.
# Fall back to Docker's embedded DNS (127.0.0.11) if resolv.conf is empty.
if grep -q '__RESOLVER__' "$ACTIVE_CONF" 2>/dev/null; then
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
  # Use a delimiter that can't appear in IPv6 addresses for sed safety.
  sed -i "s|__RESOLVER__|${RESOLVERS}|g" "$ACTIVE_CONF"
  echo "[entrypoint] nginx resolver set to: ${RESOLVERS}"
fi

# Step 3: TLS substitution (docker-compose only).
#
# TLS_HTTP_MODE controls how the port-80 listener behaves once a cert is in
# place. Valid values:
#   none         → no TLS regardless of cert presence (equivalent to leaving
#                  certs out entirely; useful as an explicit kill switch).
#   both         → port 80 serves content AND port 443 serves content.
#                  Convenient for LAN setups where some services hit BBB
#                  over plain http; carries the "browser silently drops
#                  Secure cookies on http leg" footgun (the deploy script
#                  warns about this in the prompt).
#   redirect     → port 80 returns 301 to https://… (default; the right
#                  posture for any deployment that opted into TLS).
#   https-only   → port 80 returns 444 (drop without response). For
#                  operators who explicitly do not want plain HTTP at all.
#
# If TLS_HTTP_MODE is unset or "none", we strip the placeholders without
# enabling TLS — the operator hasn't opted in.
TLS_MODE="${TLS_HTTP_MODE:-none}"
EXT_HTTPS_PORT="${EXT_HTTPS_PORT:-443}"

if [ -f "$ACTIVE_CONF" ] && grep -q '__HTTP_LISTEN__' "$ACTIVE_CONF" 2>/dev/null; then
  # Decide whether TLS is actually configured. Cert files must exist AND
  # mode must not be "none". A missing cert silently downgrades to HTTP-only
  # so a half-configured stack still boots — better UX than nginx refusing
  # to start because ssl_certificate points at a nonexistent file.
  if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ] && [ "$TLS_MODE" != "none" ]; then
    # Pick HSTS aggressiveness based on cert provenance hint. The deploy
    # script writes TLS_CERT_SOURCE into the env (self-signed | mkcert |
    # byo | letsencrypt) — only LE gets the long max-age + includeSubDomains
    # because anything else risks permanently poisoning a NAS operator's
    # Chrome HSTS cache for nas.local with no way to revoke.
    case "${TLS_CERT_SOURCE:-self-signed}" in
      letsencrypt)
        HSTS_HEADER='add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;'
        ;;
      *)
        HSTS_HEADER='add_header Strict-Transport-Security "max-age=300" always;'
        ;;
    esac

    TLS_LISTEN_BLOCK="    listen 443 ssl;
    ssl_certificate /etc/nginx/certs/local.crt;
    ssl_certificate_key /etc/nginx/certs/local.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ${HSTS_HEADER}"

    # In redirect / https-only modes the main server block drops port 80
    # entirely — the auxiliary block on /etc/nginx/conf.d/00-tls-redirect.conf
    # owns it.
    case "$TLS_MODE" in
      redirect|https-only)
        HTTP_LISTEN=''
        ;;
      *)
        HTTP_LISTEN='    listen 80;'
        ;;
    esac

    echo "[entrypoint] TLS enabled (mode=${TLS_MODE}, source=${TLS_CERT_SOURCE:-self-signed})"
  else
    TLS_LISTEN_BLOCK=''
    HTTP_LISTEN='    listen 80;'
    if [ "$TLS_MODE" != "none" ]; then
      echo "[entrypoint] TLS_HTTP_MODE=${TLS_MODE} but no cert at ${CERT_FILE} — falling back to HTTP-only"
    fi
  fi

  # Substitute placeholders. We use a python-style sentinel-and-delete
  # pattern: replace __TLS_LISTEN_BLOCK__ with a marker, append the multi-
  # line TLS block via awk, then drop the marker. sed -i with multi-line
  # replacement is awkward in BusyBox sh, so this pattern is more portable.
  python_subst() {
    # $1 = placeholder, $2 = replacement (may be multi-line). Uses awk for
    # multi-line safety.
    awk -v ph="$1" -v rep="$2" '
      {
        idx = index($0, ph)
        if (idx == 0) { print; next }
        before = substr($0, 1, idx - 1)
        after = substr($0, idx + length(ph))
        printf "%s%s%s\n", before, rep, after
      }
    ' "$ACTIVE_CONF" > "${ACTIVE_CONF}.tmp" && mv "${ACTIVE_CONF}.tmp" "$ACTIVE_CONF"
  }

  python_subst '__HTTP_LISTEN__' "$HTTP_LISTEN"
  python_subst '__TLS_LISTEN_BLOCK__' "$TLS_LISTEN_BLOCK"
fi

# Step 4: render the auxiliary redirect/444 block when needed.
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ] && \
   [ "$TLS_MODE" = "redirect" -o "$TLS_MODE" = "https-only" ] && \
   [ -r "$TLS_REDIRECT_TEMPLATE" ]; then
  case "$TLS_MODE" in
    redirect)
      TLS_RETURN="return 301 https://\$host_no_port:${EXT_HTTPS_PORT}\$request_uri;"
      ;;
    https-only)
      # 444 closes the connection without sending any response — nginx-
      # specific status, intentional. The operator picked this because they
      # explicitly do not want plain HTTP traffic acknowledged at all.
      TLS_RETURN="return 444;"
      ;;
  esac
  sed -e "s|__TLS_RETURN__|${TLS_RETURN}|g" \
      -e "s|__EXT_HTTPS_PORT__|${EXT_HTTPS_PORT}|g" \
      "$TLS_REDIRECT_TEMPLATE" > "$TLS_REDIRECT_OUT"
  echo "[entrypoint] rendered ${TLS_REDIRECT_OUT} for mode=${TLS_MODE}"
elif [ -f "$TLS_REDIRECT_OUT" ]; then
  # Clean up a stale redirect block when the operator switched to "both"
  # or disabled TLS entirely on this run.
  rm -f "$TLS_REDIRECT_OUT"
fi

exit 0
