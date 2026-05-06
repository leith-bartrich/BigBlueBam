# Notes: running BigBlueBam in Claude Code on the web

This documents what works, what does not, and what would need to change to
run a full local Docker dev stack inside Anthropic's web Claude Code
sandbox. Originally captured 2026-05-06 from a fresh sandbox VM and
updated after the end-to-end run on the same day.

## Headline result

**It works.** With one workaround applied (CA-injected shadow base
images, see "Verified workaround" below), every step of the standard
local-dev pipeline runs to completion in the web sandbox:

| Step | Outcome | Notes |
|---|---|---|
| `./scripts/dev/configure.sh -y` | ✅ | No docker needed |
| `node scripts/dev/up.mjs` | ✅ | 24 containers up, all healthy |
| `./scripts/dev/fixture-base.sh` | ✅ | Admin provisioned, 15/15 seeders ok |
| `./scripts/dev/test.sh --filter @bigbluebam/shared` | ✅ | 94/94 tests passing |

## Sandbox capability summary

| Capability | Status |
|---|---|
| `docker` / `docker compose` CLI | Installed (29.3.1 / Compose v5.1.1) |
| Docker daemon at session start | Not running, no socket |
| Passwordless sudo | Yes |
| `sudo dockerd &` | Works (~1s to socket) |
| overlayfs snapshotter | Available |
| Network egress to GitHub / GHCR / Docker Hub | Works (host) |
| RAM | 15 GiB (full stack runs comfortably) |
| Disk on `/` | 252 GB total, ~30 GB free at start |
| CPU | 4 cores |

## What ships in this branch

- `.claude/hooks/session-start.sh` — auto-starts dockerd on every web
  session. Idempotent. Gated on `CLAUDE_CODE_REMOTE=true` so it is a
  no-op on local dev machines.
- `.claude/settings.json` — registers the hook on `SessionStart`.
- `docs/web-deploy-notes.md` — this file.
- `.gitignore` exception so the hook ships with the repo.

## The underlying issue: in-container TLS

Image **builds** fail by default because the sandbox's egress is
intercepted by an Anthropic TLS-inspection proxy. From inside the VM:

```
$ openssl s_client -connect dl-cdn.alpinelinux.org:443 -servername dl-cdn.alpinelinux.org </dev/null 2>&1 | grep -E "subject=|issuer="
subject=CN = *.alpinelinux.org
issuer=O = Anthropic, CN = sandbox-egress-production TLS Inspection CA
```

The host trusts the proxy CAs via `/etc/ssl/certs/ca-certificates.crt`
(populated from four files in `/usr/local/share/ca-certificates/`:
`egress-gateway-ca-{production,staging}.crt` and
`swp-ca-{production,staging}.crt`). **Container images do not.** They
ship the standard Mozilla CA bundle and reject the inspection cert as
untrusted, which kills `apk` (and would kill `apt-get` and `pip`
similarly).

Without a fix, the failure shows up at the first `RUN apk add` line of
the first Bam Dockerfile to build (in our run it was `bond-api`,
followed by `bill-api`):

```
WARNING: fetching https://dl-cdn.alpinelinux.org/alpine/v3.23/main/x86_64/APKINDEX.tar.gz: TLS: server certificate not trusted
ERROR: unable to select packages:
  curl (no such package)
  tini (no such package)
```

## Verified workaround: shadow base images

The cleanest one-shot workaround. **Zero changes to the codebase**;
fully reversible; no commits beyond the throwaway. Works because
Compose's default `pull=missing` policy uses local images when their
tag matches.

### Mechanism

1. Pull each base image: `node:22-alpine`, `python:3.12-slim`,
   `nginx:alpine`, `postgres:16-alpine`, `redis:7-alpine`.
2. Build a one-layer shadow image per base that overwrites
   `/etc/ssl/certs/ca-certificates.crt` with the host's bundle (which
   contains the Anthropic CAs) and sets `SSL_CERT_FILE`,
   `NODE_EXTRA_CA_CERTS`, and `REQUESTS_CA_BUNDLE`.
3. Tag each shadow with the *same* name as the upstream image
   (`node:22-alpine`, etc.) in the local image store.
4. Run `docker compose up -d --build`. The project's Dockerfiles are
   unchanged — they say `FROM node:22-alpine` and Compose picks up the
   local-tagged shadow.

### Concrete recipe

```sh
mkdir -p /tmp/shadow-bases && cd /tmp/shadow-bases
{ cat /etc/ssl/certs/ca-certificates.crt; echo; \
  for f in /usr/local/share/ca-certificates/*.crt; do cat "$f"; echo; done; \
} > ca-certificates.crt

cat > Dockerfile.shadow <<'EOF'
ARG BASE
FROM ${BASE}
COPY ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
RUN mkdir -p /etc/ssl/certs && cp /etc/ssl/certs/ca-certificates.crt /etc/ssl/cert.pem 2>/dev/null || true
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt \
    REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
EOF

for spec in node:22-alpine python:3.12-slim nginx:alpine \
            postgres:16-alpine redis:7-alpine; do
  docker pull "$spec"
  docker build --build-arg "BASE=${spec}" -f Dockerfile.shadow -t "$spec" .
done
```

After this, all four `scripts/dev/*` steps run as written.

### Reversal

```sh
docker rmi node:22-alpine python:3.12-slim nginx:alpine postgres:16-alpine redis:7-alpine
for spec in node:22-alpine python:3.12-slim nginx:alpine postgres:16-alpine redis:7-alpine; do
  docker pull "$spec"
done
```

## What we measured during the verified run

- Cold full-stack build (no warm BuildKit cache): **~22 minutes**
  wall-clock for `up.mjs`, then **~5 minutes** more for the workspace
  test image. Subsequent runs hit layer cache and drop to 1-3 minutes.
- Memory at idle with the full 24-container stack: comfortably under
  the 15 GiB ceiling.
- Disk after one full run + workspace build: 25 GB used (out of
  252 GB total volume size); 18 GB images + 13 GB BuildKit cache. Tight
  but stable. `docker system prune -a` between major topology changes
  is recommended if a session is going to do multiple cold builds.
- All 24 containers reported `(healthy)` after `up.mjs` returned.
- 15/15 seeders ran clean (9 users, 5001 beacon entries, 320 banter
  messages, 16 tasks, full cross-app fixture).
- `pnpm test --filter @bigbluebam/shared`: 94/94 tests passing.
- The SessionStart hook itself ran on session resume and correctly
  no-op'd ("dockerd already running").

## Productized path (not yet implemented)

The shadow-image trick is verified but lives outside the repo. To
make a fresh web session go from cold checkout to test suite with no
manual intervention, the right shape is:

- Extend `scripts/dev/up.mjs` (or the SessionStart hook) with a
  pre-step that, when `CLAUDE_CODE_REMOTE=true` AND
  `/usr/local/share/ca-certificates/` contains entries with `O =
  Anthropic`, runs the shadow-image bootstrap above.
- The bootstrap should be idempotent (skip if the shadow tag already
  carries the marker label) and skip cleanly on local dev machines.
- Optional: a `--reset-bases` flag on `decommission.sh` that runs the
  reversal block.

The other options in `web-deploy-notes` v1 (per-Dockerfile CA
injection, switching apk repos to HTTP, publishing prebuilt images to
GHCR) are not needed once the shadow-image approach is wired in.

## Caveats and posture notes

- Trust is being moved from the public CA system to Anthropic's egress
  proxy operations. That is the same posture as any TLS-inspecting
  corporate firewall, but worth naming. Compensating control: lockfile
  checksums (`pnpm-lock.yaml`) catch silent package substitution
  downstream.
- The web sandbox should still be treated as a development workbench,
  not a production-secrets environment. Anything you push out via this
  VM is visible to the proxy in plaintext.
