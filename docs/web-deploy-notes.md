# Notes: running BigBlueBam in Claude Code on the web

This documents what works, what does not, and what would need to change to
run a full local Docker dev stack inside Anthropic's web Claude Code
sandbox. Captured 2026-05-06 from a fresh sandbox VM.

## Sandbox capability summary

| Capability | Status |
|---|---|
| `docker` / `docker compose` CLI | Installed (29.3.1 / Compose v5.1.1) |
| Docker daemon at session start | Not running, no socket |
| Passwordless sudo | Yes |
| Manual `sudo dockerd &` | Works (see `.claude/hooks/session-start.sh`) |
| overlayfs snapshotter | Available |
| Network egress to GitHub / GHCR / Docker Hub | Works (host) |
| RAM | 15 GiB |
| Disk on `/` | 30 GiB free |
| CPU | 4 cores |

## What works as-is

1. The SessionStart hook at `.claude/hooks/session-start.sh` brings up
   dockerd on demand. Idempotent. Gated on `CLAUDE_CODE_REMOTE=true` so
   it is a no-op on local dev machines.
2. `./scripts/dev/configure.sh -y` composes `.env` without docker.
3. `docker compose pull` succeeds for upstream images
   (`postgres:16-alpine`, `redis:7-alpine`, `minio/minio:latest`,
   `qdrant/qdrant:latest`, `livekit/livekit-server:latest`).

## What does NOT work as-is — and why

Image **builds** fail. Every Bam-owned service uses `node:22-alpine` and
runs `apk add --no-cache tini curl` in its production stage (and similar
for `python:3.12-slim` services). Inside the build container, that
fetch fails:

```
WARNING: fetching https://dl-cdn.alpinelinux.org/alpine/v3.23/main/x86_64/APKINDEX.tar.gz: TLS: server certificate not trusted
ERROR: unable to select packages:
  curl (no such package)
  tini (no such package)
```

### Root cause

The sandbox's egress is intercepted by an Anthropic TLS-inspection proxy.
From inside the sandbox VM:

```
$ openssl s_client -connect dl-cdn.alpinelinux.org:443 -servername dl-cdn.alpinelinux.org </dev/null 2>&1 | grep -E "subject=|issuer="
subject=CN = *.alpinelinux.org
issuer=O = Anthropic, CN = sandbox-egress-production TLS Inspection CA
```

The host trusts the proxy CA via `/etc/ssl/certs/ca-certificates.crt`
(populated from `/usr/local/share/ca-certificates/{egress-gateway-ca-{production,staging},swp-ca-{production,staging}}.crt`).
**Container images do not.** They ship the standard Mozilla CA bundle and
reject the inspection cert as untrusted, which kills `apk` (and would
kill `apt-get` and `pip` similarly).

This affects every `RUN apk add` / `RUN apt-get install` / `RUN pip install`
in every Bam Dockerfile (~20 images).

### Where this fails in the dev pipeline

- `node scripts/dev/up.mjs` runs `docker compose up -d --build`. The build
  phase walks every service Dockerfile. The first one whose `apk add`
  step runs (in our test it was `bond-api` followed by `bill-api`) fails
  with the TLS error and aborts the entire `up`.
- `./scripts/dev/test.sh` depends on the `workspace` profile being built,
  which has the same issue.
- `./scripts/dev/fixture-base.sh` depends on `up.mjs` having succeeded.

## Possible fixes (not implemented here)

Listed in rough order of cleanness. None is implemented in this branch
because each polluts production code or build infra to work around a
sandbox-specific quirk; the right call is for the user to decide which
tradeoff is acceptable.

1. **Sandbox-only Compose override + base image.** Ship a tiny base
   image (e.g. `bigbluebam-base:node22-alpine`) that takes
   `node:22-alpine`, copies `/etc/ssl/certs/ca-certificates.crt` from
   the host, and runs `update-ca-certificates`. Have a gitignored
   `docker-compose.override.yml` (managed by
   `scripts/dev/compose-overrides.sh`) point every service's `build:`
   at a Dockerfile that starts `FROM bigbluebam-base:node22-alpine`
   instead of `FROM node:22-alpine`. **Pros:** zero changes to
   production Dockerfiles. **Cons:** has to be applied per-service,
   and the overlay layer is non-trivial.

2. **Dockerfile-level CA injection.** Add three lines to every
   `node:22-alpine` Dockerfile:
   ```dockerfile
   ARG EGRESS_CA=
   RUN if [ -n "$EGRESS_CA" ]; then echo "$EGRESS_CA" > /usr/local/share/ca-certificates/egress.crt && update-ca-certificates; fi
   ```
   Then build with `--build-arg EGRESS_CA="$(cat /etc/ssl/certs/ca-certificates.crt)"` from a sandbox-only wrapper.
   **Pros:** clean, opt-in, one-line at runtime. **Cons:** edits ~20
   production Dockerfiles for a non-production reason.

3. **Switch Alpine repos to HTTP inside builds.** Add `RUN sed -i 's|https://|http://|g' /etc/apk/repositories` before `apk add`.
   **Pros:** trivial. **Cons:** weakens the supply-chain posture of
   production images. **Don't do this.**

4. **Pull pre-built images from a registry.** Publish per-service images
   to GHCR from a CI runner that's outside the sandbox, then have the
   sandbox `docker compose pull` instead of build. **Pros:** cleanest.
   **Cons:** requires CI to publish + a Compose mode that pulls instead
   of builds.

5. **Build images outside the sandbox, `docker save` to a tarball,
   `docker load` inside.** Useful as a one-shot for a single feature
   spike. Not a sustainable workflow.

## What was committed in this branch

- `.claude/hooks/session-start.sh` — auto-starts dockerd in the web
  sandbox; no-op locally.
- `.claude/settings.json` — registers the hook on `SessionStart`.
- `docs/web-deploy-notes.md` — this file.

The dockerd auto-start is independently useful (it removes a manual
step) even though it doesn't unblock the full stack build by itself.
The TLS-CA blocker is documented but not fixed.
