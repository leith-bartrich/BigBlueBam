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

This branch carries only this report. Both the dockerd-bootstrap and
the CA-injection workarounds described below were verified end-to-end
in a sandbox session but were intentionally not committed — the
maintainer wants to design the productized solution from scratch
rather than merge a quick fix.

## Issue 1: dockerd is not running at session start

The sandbox ships the `docker` and `docker compose` binaries but no
running daemon. Every dev script under `scripts/dev/` calls
`assertDockerRunning()` from `scripts/lib/preflight.mjs` and aborts
when the socket is missing. This needs to be solved before any of the
container-related issues even surface.

Two facts make this easy to handle:

- `sudo -n true` succeeds (passwordless sudo).
- `sudo dockerd > /tmp/dockerd.log 2>&1 &` produces a usable
  `/var/run/docker.sock` in ~1s, with overlayfs as the snapshotter.

### Verified one-shot

Run this once at the start of a session before invoking
`scripts/dev/configure.sh`:

```sh
sudo dockerd > /tmp/dockerd.log 2>&1 &
disown
until [ -S /var/run/docker.sock ]; do sleep 1; done
sudo chgrp docker /var/run/docker.sock 2>/dev/null || true
sudo chmod g+rw /var/run/docker.sock 2>/dev/null || true
```

After this, `docker info` reports a Server section without errors and
the rest of the pipeline can run.

### Productized shape (not implemented)

A Claude Code SessionStart hook is the natural place for this — it
fires automatically at the start of every session and the harness
exposes `CLAUDE_CODE_REMOTE=true` to gate the behavior to web sessions
only (no-op on a contributor's laptop where dockerd is already up).

Sketch:

- `.claude/hooks/session-start.sh` — bash script: if
  `CLAUDE_CODE_REMOTE=true` and `/var/run/docker.sock` is missing and
  passwordless sudo works, launch `sudo dockerd` in the background and
  poll for the socket up to 30s. Print one line on success; emit
  diagnostics on failure but do not block session start.
- `.claude/settings.json` — register the script under
  `hooks.SessionStart[].hooks[].command`.
- `.gitignore` — the project currently gitignores `.claude/` wholesale.
  To check the hook in for every contributor, replace `.claude/` with
  `.claude/*` (which lets git traverse into the directory) and add
  `!.claude/settings.json` and `!.claude/hooks/` exceptions. The
  trailing-slash form blocks negations from firing.

In a verified test of this exact shape, the hook took ~1s on cold
start and correctly no-op'd on session resume ("dockerd already
running; nothing to do.").

A different shape worth considering: keep dockerd-startup out of
`.claude/` entirely and put the bootstrap in `scripts/dev/up.mjs`'s
preflight (currently `assertDockerRunning()` aborts hard; could be
made to attempt a start under `CLAUDE_CODE_REMOTE=true` first). That
keeps the contract entirely inside `scripts/dev/` and avoids the
gitignore dance, at the cost of not running until something invokes
`up.mjs`.

## Issue 2: in-container TLS

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

## Verified workaround for issue 2: shadow base images

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
- The dockerd-bootstrap (issue 1) ran on session resume and correctly
  no-op'd ("dockerd already running") when invoked against an
  already-warm daemon.

## Productized path (not yet implemented)

A fresh web session should be able to go from cold checkout to a
running test suite without manual intervention. To get there, both
issues need a permanent home in the repo. Suggested shape:

1. **Issue 1 (dockerd)** — handle in a SessionStart hook or in
   `scripts/dev/up.mjs`'s preflight. Either way, gate on
   `CLAUDE_CODE_REMOTE=true` so it is a no-op locally. See "Productized
   shape" under issue 1 above for the two main flavors.

2. **Issue 2 (shadow base images)** — most natural fit is a pre-step
   in `scripts/dev/up.mjs` (or a small `scripts/dev/shadow-bases.sh`
   that `up.mjs` calls) that runs the bootstrap recipe when
   `CLAUDE_CODE_REMOTE=true` AND `/usr/local/share/ca-certificates/`
   contains entries with `O = Anthropic`. The pre-step should be
   idempotent: tag a marker label on each shadow image (e.g.
   `LABEL bigbluebam.shadow=anthropic-egress-ca`) and skip rebuild if
   the existing local tag already carries it.

3. **Optional**: a `--reset-bases` flag on `decommission.sh` that
   removes the shadow tags and re-pulls the genuine upstream images,
   for the rare case where a contributor wants to verify a build
   against unmodified bases.

The other options considered earlier (per-Dockerfile CA injection,
switching apk repos to HTTP, publishing prebuilt images to GHCR) are
not needed once the shadow-image approach is wired in. Per-Dockerfile
edits are particularly worth avoiding — they would put a
sandbox-specific concern into ~20 production Dockerfiles.

## Caveats and posture notes

- Trust is being moved from the public CA system to Anthropic's egress
  proxy operations. That is the same posture as any TLS-inspecting
  corporate firewall, but worth naming. Compensating control: lockfile
  checksums (`pnpm-lock.yaml`) catch silent package substitution
  downstream.
- The web sandbox should still be treated as a development workbench,
  not a production-secrets environment. Anything you push out via this
  VM is visible to the proxy in plaintext.
