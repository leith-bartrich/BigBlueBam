#!/usr/bin/env bash
#
# session-start.sh — Claude Code SessionStart hook.
#
# Purpose: in the Claude Code on the web sandbox, the Docker daemon is not
# running at session start (the VM ships the docker CLI + Compose plugin but
# leaves the daemon off). This hook starts dockerd so that
# `node scripts/dev/up.mjs` and the rest of scripts/dev/* can run.
#
# Behavior:
#   - No-op unless CLAUDE_CODE_REMOTE=true (skip on local dev machines).
#   - No-op if /var/run/docker.sock already exists.
#   - Requires passwordless sudo (the web sandbox provides this).
#   - Synchronous: returns once the socket is ready (~1-3s in practice).
#
# Caveat (as of this writing): the sandbox's egress proxy intercepts TLS
# with the "Anthropic sandbox-egress-production TLS Inspection CA". The host
# trusts that CA via /etc/ssl/certs/ca-certificates.crt, but Docker base
# images (e.g. node:22-alpine) do not. As a result `docker compose up
# --build` will fail at the first `apk add` / `apt-get install` step with
# "TLS: server certificate not trusted". This hook still does the right
# thing (dockerd up), but a full local stack build needs a separate fix —
# see docs/web-deploy-notes.md.

set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if [ -S /var/run/docker.sock ]; then
  echo "[session-start] dockerd already running; nothing to do."
  exit 0
fi

if ! sudo -n true 2>/dev/null; then
  echo "[session-start] no passwordless sudo; cannot start dockerd. Skipping." >&2
  exit 0
fi

echo "[session-start] starting dockerd..."
sudo nohup dockerd > /tmp/dockerd.log 2>&1 &
disown || true

deadline=$(( $(date +%s) + 30 ))
while [ ! -S /var/run/docker.sock ]; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "[session-start] dockerd did not produce /var/run/docker.sock within 30s." >&2
    echo "[session-start] last 20 log lines:" >&2
    tail -20 /tmp/dockerd.log >&2 || true
    exit 0
  fi
  sleep 1
done

sudo chgrp docker /var/run/docker.sock 2>/dev/null || true
sudo chmod g+rw /var/run/docker.sock 2>/dev/null || true

server_version=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo unknown)
echo "[session-start] dockerd ready (server ${server_version}); socket at /var/run/docker.sock."
