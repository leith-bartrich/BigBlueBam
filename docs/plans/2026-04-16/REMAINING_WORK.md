# Remaining Work (2026-04-16)

Cross-referenced against everything that has landed on `recovery` through the Wave 0-4 recovery orchestration, the seeding pass, Wave 2B frontend, Wave 2C worker jobs, and the Helpdesk multi-tenant routing work. Items already closed are omitted.

---

## Infrastructure / CI

- [P0] **CI verification on Linux.** `pnpm install`, `typecheck`, `test`, `lint:migrations`, `db:check` have never run against `recovery`. Record this as a future validation check that we need to standardize but it should not prevent moving forward.
- [P1] **db-check coverage.** `scripts/db-check.mjs` only parses Drizzle schemas in `apps/api`, `apps/helpdesk-api`, `apps/banter-api`. 11 other API apps have Drizzle schemas that are unchecked for drift.
- [P2] **CI migration-replay workflow.** `.github/workflows/migration-replay.yml` exists but hasn't run against the 84-migration chain on `recovery`.

## Database / Migrations

- [P1] **Reserved slots 0081, 0082, 0095, 0098, 0101, 0102 unused.** Beacon, Board, Bolt, Book reserved these and never claimed them. Not a bug, just bookkeeping to clear in the ledger.
- [P2] **Activity log partitioning.** Monthly partitions described in the design doc but never implemented. Plain table works; partitioning is a scaling concern.

## Platform (Bam core)

- [P1] **Unified error handler rollout.** `@bigbluebam/logging` exports `createErrorHandler` but the 14 API services still use their per-app error handlers. Wiring them to the shared one is a mechanical sweep.
- [P1] **Health/readiness probe rollout.** `@bigbluebam/service-health` exports `healthCheckPlugin` but isn't registered in most API services yet. Same sweep as above.
- [P1] **db-stubs rollout.** `@bigbluebam/db-stubs` exists but the 13 non-Bam services still have local `bbb-refs.ts` copies. Replace with re-exports.
- [P1] **Auth: API key grace-period honoring in `auth.ts`.** The rotate route (migration 0117) creates successor + marks predecessor, but `auth.ts` `verifyApiKey` does not yet accept predecessor tokens during their grace window.
- [P2] **Admin UI for OAuth provider configuration.** Providers are seeded via DB; no UI to configure client_id/secret/redirect.
- [P2] **Bam admin UI for Helpdesk default project.** MCP tool covers it; `/b3/settings/helpdesk` page deferred.

## Per-App Gaps

### Beacon
- [P1] Graph explorer: page exists but sparse; needs node/edge visualization.
- [P1] Semantic search re-ranking (Qdrant cross-encoder).
- [P2] Freshness decay and expiry badges on stale entries.

### Bearing
- [P1] EpicPicker + TaskQueryBuilder (depends on Bam API integration for linked KR progress mode).
- [P1] Watcher email notification delivery (worker side).
- [P2] Export to PDF/CSV.

### Bench
- [P1] Puppeteer dashboard export pipeline (worker job exists as skeleton; actual rendering deferred).
- [P1] Saved queries CRUD routes + UI page.
- [P1] Date-range-aware result caching.
- [P2] Manager role access relaxation (role hierarchy lacks "manager" tier).

### Bill
- [P1] Invoice overdue reminder job runs but does not actually send email (SMTP log-only when `SMTP_HOST` unset).
- [P1] Expense receipt MinIO upload (`@fastify/multipart` not yet in bill-api).
- [P1] Time-entry-to-invoice wizard.
- [P2] Bond auto-invoice on deal-close.

### Blank
- [P1] File-upload field processing worker runs but does 10%-random-failure simulation. Real virus scanning / content extraction deferred.
- [P1] Conditional logic routing (form to Bond contact or to Helpdesk ticket based on answers).
- [P2] Multi-page forms.

### Blast
- [P1] Segment filter evaluation engine (JSONB `filter_criteria` stored but not executed server-side).
- [P1] AI content generation for campaigns (LLM provider integration).
- [P1] Device/client breakdown analytics from `client_info` column.
- [P2] Email footer compliance validation (CAN-SPAM).

### Board
- [P1] Export routes (SVG/PNG/PDF) with actual rendering.
- [P1] Thumbnail generation worker job.
- [P1] Element count soft/hard limit enforcement (constants defined, hook not wired).
- [P1] Template application on board create (templates exist in DB; `yjs_state` column on templates from migration 0093 seeded but not consumed by the create flow).
- [P2] Spatial clustering endpoint.

### Bolt
- [P1] Real LLM integration for `/ai/generate` and `/ai/explain` endpoints (currently stubs).
- [P1] Field autocomplete UI for FieldPicker and TemplateVariableHelper.
- [P1] Execution cleanup job (nightly purge of 90+ day old executions).
- [P2] Automation versioning and rollback UI.

### Bond
- [P1] `include_deleted` query param on list/get services so the "Include deleted" frontend toggle works.
- [P1] Deal detail cross-link rail (Bond invoice, Book event, Bam task aggregated in one place).
- [P1] CSV import pipeline with column-mapping UX (schema + REST surface exist; pipeline itself is incomplete).
- [P1] Bulk lead-score recalculation worker.
- [P2] Scoring rule builder UI.

### Book
- [P1] Cross-product timeline aggregation service (queries Bam tasks, Bond deals, Bearing goals in one view).
- [P1] External calendar polling worker (Google/Outlook translucent blocks).
- [P1] Auto-create Bond contact + Bam task on public booking.
- [P2] Booking page editor for hosts (slot availability, redirect URL, confirmation message).

### Brief
- [P0] Yjs/Hocuspocus real-time collaboration wiring. Persistence service exists (`yjs-persistence.service.ts`), but Hocuspocus server, Redis extension, and Tiptap Collaboration/CollaborationCursor are not wired.
- [P1] 7 missing Tiptap extensions: Mention, TaskEmbed, BeaconEmbed, Callout, SlashCommand, BubbleMenu, ChannelLink.
- [P1] Qdrant semantic search integration (embedding service exists; vector queries not yet surfaced in UI).
- [P1] Background jobs: `brief:embed`, `brief:snapshot`, `brief:export`, `brief:cleanup`.
- [P2] Collaborator permission granularity (view/comment/edit per user).

### Banter
- [P0] AI voice agent pipeline (LiveKit Agents SDK + STT/TTS). `apps/voice-agent/` is a Python placeholder.
- [P1] STT transcription pipeline for recorded calls.
- [P1] Cross-product rich embeds (Bam task preview, Bond deal card, etc).
- [P1] Link previews (og:image + og:title unfurling).
- [P1] Screen sharing in calls.
- [P1] Unread cursor sync across devices.
- [P1] Per-channel retention enforcement worker.
- [P1] Parent-table partition conversion for `banter_messages` (0106 no-ops gracefully but the expand-contract migration to convert the plain table hasn't shipped).

### Helpdesk
- [P1] Agent ticket queue in a proper agent-facing SPA (current `/helpdesk/` is customer-facing; agent routes require per-agent API key auth that is incompatible with session cookies). Best candidate: dedicated `/b3/superuser/helpdesk/` agent console.
- [P1] Email notification worker (verification, password reset, reply notification, status-change alerts).
- [P1] Per-org branding (logo, colors, custom domain). Schema supports it; no UI.
- [DESIGN-DECISION] **Host-based subdomain routing** deferred per D-010. Path-based slug routing shipped and working. Revisit when SaaS deployments request `support.<org>.yourdomain.example`.
- [P2] Reserved-slug validation on org creation (slugs `login`, `register`, `verify`, `tickets` collide with SPA route segments).

## MCP Server

- [P1] Tool drift guard enforcement in CI (`scripts/check-bolt-catalog.mjs` wired into `pnpm check:bolt-catalog` but not in a GitHub Actions job).
- [P2] `MCP_INTERNAL_API_TOKEN` provisioning automation (currently manual via `create-service-account` CLI).

## Seeding

- [P1] `bearing_goals` idempotency: title-only dedup prevents re-seeding after partial failures if same title appears across periods. Widen key to `(org_id, period_id, title)`.
- [P1] `INV-2026-0042` has 2 rows in mage-inc (seed re-run artifact). Clean up or add invoice-number uniqueness guard.
- [P2] `scripts/seed-verify.mjs` post-seed checker (asserts minimum row counts per table).
- [P2] `docs/seeding-smoke-test.md` click-through checklist.
- [P2] CI GitHub Action that re-runs `seed-all.mjs` against a scratch postgres.

## Documentation

- [P1] `docs/getting-started.md` -- "What gets seeded" row-count table and "Re-seeding after a wipe" subsection.
- [P2] `docs/seeding-smoke-test.md` -- 14-URL click-through checklist.

## Cross-Product / Integration

- [P1] Notification fan-out dispatcher (unified email/Banter/Brief notifications; Cross_Product_Plan G6).
- [P1] End-to-end integration-tests CI run (harness exists at `apps/integration-tests/`; needs wiring into a GitHub Actions workflow).
- [P2] Per-app-pair cross-product link verification (e.g. Blank form submission creates Bond contact).
