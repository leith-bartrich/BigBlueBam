# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BigBlueBam is a web-based, multi-user Kanban project planning tool with sprint-based task management. It supports multiple concurrent projects with fully configurable phases, task states, custom fields, and carry-forward mechanics. Target audience is small-to-medium teams (2-50 users).

The authoritative design specification is `BigBlueBam_Design_Document.md` in the repo root. Consult it for detailed data models, API contracts, MCP tool schemas, animation specs, and UI layouts.

## Tech Stack

**Frontend (SPA):** React 19, Motion (v11+, formerly Framer Motion), TanStack Query v5, Zustand, dnd-kit, TailwindCSS v4, Radix UI, Tiptap (rich text), React Hook Form + Zod

**API:** Node.js 22 LTS, Fastify v5, Drizzle ORM, Zod (shared validation schemas with client), Socket.IO or native WebSocket + Redis PubSub, BullMQ

**Data:** PostgreSQL 16 (RLS, JSONB custom fields, partitioned activity log), Redis 7 (sessions, cache, pubsub, queues), MinIO/S3 (attachments), Qdrant (vector search for Beacon semantic retrieval)

**MCP Server:** `@modelcontextprotocol/sdk`, Streamable HTTP + SSE + stdio transports, runs as sidecar container on internal :3001, exposed at `/mcp/` via nginx on port 80

## Architecture

Monorepo managed with **Turborepo** and **pnpm workspaces**.

```
apps/
  api/          — Fastify REST API + WebSocket server (internal :4000, proxied at /b3/api/) — 23 route files, 24 schema tables, ~63 source files
  frontend/     — React SPA served by nginx at /b3/ (port 80) — ~55 source files, 8 pages, command palette, keyboard shortcuts
  banter-api/   — Banter Fastify REST API + WebSocket (internal :4002, proxied at /banter/api/) — 15 route files, 18 schema tables, ~45 source files
  banter/       — Banter React SPA served by nginx at /banter/ — ~39 source files, 7 pages, 14 components (ALPHA)
  mcp-server/   — MCP protocol server (internal :3001, proxied at /mcp/) — 140 tools (64 Bam + 47 Banter + 29 Beacon), 10+ resources, 8 prompts, 15 tool modules
  worker/       — BullMQ background job processor (no exposed port) — 6 job handlers (email, notification, export, sprint-close, banter-notification, banter-retention)
  helpdesk-api/ — Helpdesk Fastify API (internal :4001, proxied at /helpdesk/api/)
  helpdesk/     — Helpdesk React SPA served by nginx at /helpdesk/
  beacon-api/   — Beacon Fastify API (internal :4004, proxied at /beacon/api/) — knowledge base, search, graph, policies
  beacon/       — Beacon React SPA served by nginx at /beacon/ — knowledge home, graph explorer, editor
  voice-agent/  — AI voice agent (Python/FastAPI, internal :4003) — LiveKit Agents SDK, STT/TTS pipeline (placeholder)
packages/
  shared/       — Shared Zod schemas, types, constants (@bigbluebam/shared)
infra/
  postgres/     — migrations/ (numbered, idempotent SQL migrations)
  nginx/        — nginx.conf, certs
  livekit/      — LiveKit SFU configuration (livekit.yaml)
  helm/         — Kubernetes Helm chart (bigbluebam/)
scripts/        — Utility scripts (seed-frndo.js)
```

The entire stack runs via `docker compose up`. All services are accessed through a single nginx container on port 80:

- `http://DOMAIN/` redirects to `/helpdesk/`
- `http://DOMAIN/b3/` serves the Bam SPA
- `http://DOMAIN/b3/api/` proxies to the Fastify REST API
- `http://DOMAIN/b3/ws` proxies WebSocket connections
- `http://DOMAIN/banter/` serves the Banter SPA (alpha)
- `http://DOMAIN/banter/api/` proxies to the Banter REST API
- `http://DOMAIN/banter/ws` proxies Banter WebSocket connections
- `http://DOMAIN/beacon/` serves the Beacon knowledge base SPA
- `http://DOMAIN/beacon/api/` proxies to the Beacon API
- `http://DOMAIN/helpdesk/` serves the Helpdesk portal SPA
- `http://DOMAIN/helpdesk/api/` proxies to the Helpdesk API
- `http://DOMAIN/files/` serves uploaded files from MinIO
- `http://DOMAIN/mcp/` proxies to the MCP server

Application containers (api, banter-api, beacon-api, mcp-server, worker, helpdesk-api, frontend, voice-agent) are stateless and scale horizontally. Data services (postgres, redis, minio, qdrant) can be swapped for managed cloud equivalents by changing environment variables only.

## IMPORTANT: Preserving Test Data

**NEVER run `docker compose down -v` unless the user explicitly asks to wipe the database.** The `-v` flag destroys all persistent volumes (PostgreSQL data, Redis data, MinIO uploads). Instead:

- Rebuild and restart individual services: `docker compose build api && docker compose up -d --force-recreate api`
- Restart nginx after rebuilds: `docker compose restart frontend`
- Stop without wiping: `docker compose down` (no `-v`)
- Only target what changed: `docker compose build frontend && docker compose up -d --force-recreate frontend`

The test database contains seeded projects, users, tickets, and conversations that are time-consuming to recreate.

## Database Schema & Migrations

**Single source of truth:** `infra/postgres/migrations/NNNN_*.sql` — append-only, idempotent numbered migration files. `0000_init.sql` is the canonical baseline; subsequent files layer schema evolution on top. There is no `init.sql` — the postgres container boots with an empty DB and the `migrate` service creates everything.

The `migrate` service (reuses the api image, runs `node dist/migrate.js`) is a `service_completed_successfully` dependency of every DB-using service — api, helpdesk-api, banter-api, worker. It runs automatically on every `docker compose up`, tracks applied migrations in the `schema_migrations` table with SHA-256 checksums, and is a no-op once the DB is current.

**When you change the schema:**

1. Update the Drizzle schema file in `apps/*/src/db/schema/`.
2. Add a **new** numbered file in `infra/postgres/migrations/` that applies the change idempotently (use `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER ...`, or guarded `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` blocks). **Never edit an existing migration** — the runner records a SHA-256 checksum per file and aborts on mismatch.
3. Rebuild the api image (`docker compose build api`) so the new migration is baked in, then `docker compose up -d` — the migrate service will apply it before app services start.

Every migration must be idempotent so the same migration file is safe to run against both empty DBs and DBs that may already have the object (e.g., from the historical init.sql bootstrap).

### Drift guard

`pnpm db:check` runs `scripts/db-check.mjs`, which parses every Drizzle `pgTable(...)` declaration across `apps/api`, `apps/helpdesk-api`, and `apps/banter-api`, then diffs the union against the live database pointed to by `DATABASE_URL`. It prints any table/column declared in Drizzle but missing in the DB, or present in the DB but not declared in any Drizzle schema, and exits 1 on drift (type mismatches are warnings only). Start the stack first: `docker compose up -d postgres migrate`.

CI runs it on every PR and every push to `main` via `.github/workflows/db-drift.yml`, against a fresh `postgres:16-alpine` service container with `init.sql` + all migrations applied. **When it fails: do not edit an existing migration.** Update the Drizzle schema file and add a new numbered migration in `infra/postgres/migrations/` with the same change in idempotent form, then rerun.

### Migration conventions

Every file in `infra/postgres/migrations/` MUST:

1. **Filename**: match `^[0-9]{4}_[a-z][a-z0-9_]*\.sql$` (4-digit sequence + snake_case).
2. **Header**: the first ~20 lines must contain a comment block with the filename marker, a `-- Why:` line (1-3 sentences on motivation), and a `-- Client impact:` line (`none` / `additive only` / `expand-contract step N/M` / …).
3. **Idempotency**: use `CREATE TABLE IF NOT EXISTS`, `CREATE [UNIQUE] INDEX IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP TABLE/INDEX/COLUMN IF EXISTS`. `CREATE TRIGGER` must be preceded by `DROP TRIGGER IF EXISTS ... ;` or wrapped in a `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` block.
4. **Destructive ALTERs** (`DROP COLUMN`, `SET NOT NULL`, etc.) must be wrapped in a guarded `DO $$` block that tolerates re-runs.

Enforced by `pnpm lint:migrations` (`scripts/lint-migrations.mjs`), run in CI by `.github/workflows/db-drift.yml` (job `migration-lint`). Rare exceptions may be silenced per-line with an inline `-- noqa: <rule-name>` comment.

**Checksum behavior:** the runner hashes the SQL *body* only — the leading `--` comment header is stripped before hashing, so editing `-- Why:` / `-- Client impact:` text never invalidates an applied migration. Any change to executable SQL still trips the immutability guard. For the one-time rollout where headers were added to already-applied migrations, rerun the migrate container with `MIGRATE_ALLOW_HEADER_RESTAMP=1` to re-stamp stored checksums.

## Common Commands

```bash
# First-time setup
cp .env.example .env   # Edit secrets before starting
pnpm install           # Install all dependencies

# Start full stack (production mode)
docker compose up -d

# Start full stack (dev mode with hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Run database migrations (schema lives in infra/postgres/migrations/*.sql, applied by the migrate service)
docker compose run --rm migrate

# Create initial admin user
docker compose exec api node dist/cli.js create-admin \
  --email admin@example.com --password your-password-here \
  --name "Admin" --org "My Organization"

# View logs
docker compose logs -f api mcp-server worker

# Build a specific app
pnpm --filter @bigbluebam/shared build
pnpm --filter @bigbluebam/api build

# Run tests (~530+ tests total)
pnpm test                                    # All packages
pnpm --filter @bigbluebam/shared test        # Shared schemas only
pnpm --filter @bigbluebam/api test           # API unit tests
pnpm --filter @bigbluebam/frontend test      # Frontend component tests
pnpm --filter @bigbluebam/banter-api test    # Banter API unit tests (54 tests)
pnpm --filter @bigbluebam/banter test        # Banter frontend component tests (14 tests)
```

### CI Pipeline

- **Every push:** lint (Biome), typecheck (`tsc --noEmit`), unit tests (Vitest)
- **PR:** ephemeral Docker Compose stack for integration tests
- **Merge to main:** build images, push to GHCR, deploy to staging
- **Tag (`v*`):** promote to production with zero-downtime rolling update

## Key Design Decisions

- **Zod schemas are shared** between client and API (`@bigbluebam/shared`). Single source of truth for validation.
- **Optimistic updates** via TanStack Query for all mutations. Rollback on failure with animated revert.
- **Cursor-based pagination** on all list endpoints. Filter pattern: `?filter[field]=value`. Sort: `?sort=-field`.
- **Conflict resolution** is last-write-wins with `updated_at` stale check (HTTP 409). Board position conflicts resolved server-side with authoritative broadcast.
- **Task positions** use float values for cheap reordering without renumbering siblings.
- **Custom fields** stored as JSONB on tasks, with definitions in `custom_field_definitions` table per project.
- **Carry-forward** is a first-class concept: tasks track `carry_forward_count` and `original_sprint_id`. Cards display a badge when carried forward.
- **Activity log** is append-only, partitioned monthly by `created_at`.
- **MCP destructive actions** (delete task, complete sprint, remove member) require a two-step confirmation flow via `confirm_action` tool with time-limited action tokens.
- **API keys** prefixed `bbam_`, stored as Argon2id hashes, scoped to read/read_write/admin with optional project restriction.
- **Task templates** allow creating reusable task blueprints with title patterns, default fields, and auto-generated subtasks.
- **Saved views** persist filter/sort/swimlane configurations per user or shared across the project.
- **Time entries** are separate rows (not just a counter on tasks), enabling per-user per-day time tracking reports.
- **Comment reactions** use toggle semantics with a unique constraint on `(comment_id, user_id, emoji)`.
- **iCal feed** exports tasks with due dates as an .ics calendar feed, authenticated via API key in query string.
- **Import system** supports CSV, Trello, Jira, and GitHub Issues, with automatic phase/label creation for unmatched values.
- **WebSocket realtime** uses Redis PubSub for cross-instance broadcasting; rooms are scoped to org, project, and user levels.
- **Keyboard shortcuts** and a **command palette** (Cmd+K) are built into the frontend for power-user navigation.
- **User and member management** is consolidated at `/b3/people` (org admins/owners) and `/b3/superuser/people` (platform SuperUsers) — not under Settings — with tabbed user-detail pages covering profile, projects, access (API keys/sessions/passwords), and activity.

## Error Response Envelope

All API errors follow this structure:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": [{ "field": "title", "issue": "required" }],
    "request_id": "req_abc123"
  }
}
```

## Environment Configuration

Required env vars: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `SESSION_SECRET`. See `.env.example` for the full list including optional OAuth, SMTP, and port overrides.

## Development Phases

The project is planned in 7 phases over ~30 weeks. Phase 1 (Foundation) covers monorepo scaffolding, Docker stack, auth, org/user/project CRUD, basic board with drag-and-drop. Refer to Section 26 of the design document for the full breakdown.
