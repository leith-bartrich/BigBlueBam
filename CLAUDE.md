# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BigBlueBam is a web-based, multi-user Kanban project planning tool with sprint-based task management. It supports multiple concurrent projects with fully configurable phases, task states, custom fields, and carry-forward mechanics. Target audience is small-to-medium teams (2-50 users).

The authoritative design specification is `BigBlueBam_Design_Document.md` in the repo root. Consult it for detailed data models, API contracts, MCP tool schemas, animation specs, and UI layouts.

## Tech Stack

**Frontend (SPA):** React 19, Motion (v11+, formerly Framer Motion), TanStack Query v5, Zustand, dnd-kit, TailwindCSS v4, Radix UI, Tiptap (rich text), React Hook Form + Zod

**API:** Node.js 22 LTS, Fastify v5, Drizzle ORM, Zod (shared validation schemas with client), Socket.IO or native WebSocket + Redis PubSub, BullMQ

**Data:** PostgreSQL 16 (RLS, JSONB custom fields, partitioned activity log), Redis 7 (sessions, cache, pubsub, queues), MinIO/S3 (attachments)

**MCP Server:** `@modelcontextprotocol/sdk`, Streamable HTTP + SSE + stdio transports, runs as sidecar container on internal :3001, exposed at `/mcp/` via nginx on port 80

## Architecture

Monorepo managed with **Turborepo** and **pnpm workspaces**.

```
apps/
  api/          — Fastify REST API + WebSocket server (internal :4000, proxied at /b3/api/) — 23 route files, 24 schema tables, ~63 source files
  frontend/     — React SPA served by nginx at /b3/ (port 80) — ~55 source files, 8 pages, command palette, keyboard shortcuts
  mcp-server/   — MCP protocol server (internal :3001, proxied at /mcp/) — 38 tools, 7 resources, 4 prompts, 10 tool modules
  worker/       — BullMQ background job processor (no exposed port) — 4 job handlers (email, notification, export, sprint-close)
  helpdesk-api/ — Helpdesk Fastify API (internal :4001, proxied at /helpdesk/api/)
  helpdesk/     — Helpdesk React SPA served by nginx at /helpdesk/
packages/
  shared/       — Shared Zod schemas, types, constants (@bigbluebam/shared)
infra/
  postgres/     — init.sql
  nginx/        — nginx.conf, certs
  helm/         — Kubernetes Helm chart (bigbluebam/)
scripts/        — Utility scripts (seed-frndo.js)
```

The entire stack runs via `docker compose up`. All services are accessed through a single nginx container on port 80:

- `http://DOMAIN/` redirects to `/helpdesk/`
- `http://DOMAIN/b3/` serves the BigBlueBam SPA
- `http://DOMAIN/b3/api/` proxies to the Fastify REST API
- `http://DOMAIN/b3/ws` proxies WebSocket connections
- `http://DOMAIN/helpdesk/` serves the Helpdesk portal SPA
- `http://DOMAIN/helpdesk/api/` proxies to the Helpdesk API
- `http://DOMAIN/files/` serves uploaded files from MinIO
- `http://DOMAIN/mcp/` proxies to the MCP server

Application containers (api, mcp-server, worker, helpdesk-api, frontend) are stateless and scale horizontally. Data services (postgres, redis, minio) can be swapped for managed cloud equivalents by changing environment variables only.

## IMPORTANT: Preserving Test Data

**NEVER run `docker compose down -v` unless the user explicitly asks to wipe the database.** The `-v` flag destroys all persistent volumes (PostgreSQL data, Redis data, MinIO uploads). Instead:

- Rebuild and restart individual services: `docker compose build api && docker compose up -d --force-recreate api`
- Restart nginx after rebuilds: `docker compose restart frontend`
- Stop without wiping: `docker compose down` (no `-v`)
- Only target what changed: `docker compose build frontend && docker compose up -d --force-recreate frontend`

The test database contains seeded projects, users, tickets, and conversations that are time-consuming to recreate.

## Common Commands

```bash
# First-time setup
cp .env.example .env   # Edit secrets before starting
pnpm install           # Install all dependencies

# Start full stack (production mode)
docker compose up -d

# Start full stack (dev mode with hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Run database migrations (schema lives in infra/postgres/init.sql, loaded on first start)
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

# Run tests (~315 test files, 439 tests total)
pnpm test                                    # All packages
pnpm --filter @bigbluebam/shared test        # Shared schemas only
pnpm --filter @bigbluebam/api test           # API unit tests
pnpm --filter @bigbluebam/frontend test      # Frontend component tests
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
