# Future Work

What's genuinely unfinished on `main`. Updated: 2026-04-05.

Both audits are now fully closed:
- **Helpdesk↔BBB:** 53/57 resolved, 3 partial, 1 deferred, **0 open**
- **Permissions:** 81/82 resolved, 1 partial (documented tradeoff), **0 open**

---

## Un-started from the original design doc

These are real feature roadmap items — net-new work, not cleanup.

### Phase 6 — Reporting & Integrations
- **Burndown / velocity / CFD charts** — sprint reports exist in data but no chart UI
- **GitHub integration** — commit linking (`BBB-247` in a commit message auto-attaches to the task), PR auto-transitions
- **Slack integration** — bot + slash commands (separate from Banter's internal messaging)

### Phase 7 — Scale & Polish
- **Accessibility audit** — no formal a11y pass has been done
- **Board virtualization** — large boards (500+ cards) may have render perf issues; virtualize rows
- **Redis caching layer** — some hot paths (org settings, project listings) could be cached for read-heavy workloads

---

## Smaller items flagged during recent work

### Integration tests for helpdesk agent auth
`apps/helpdesk-api/test/security.test.ts` has 13 passing unit tests + **7 `it.todo` placeholders** for end-to-end flows that need a real DB fixture (ticket creation, ownership enforcement, internal-note visibility). Would close those out. ~1 day.

### helpdesk_login_history table
BBB gained a `login_history` table tracking successful+failed login attempts per user. Helpdesk customer logins are NOT recorded because the FK points at `users`, not `helpdesk_users`. A parallel `helpdesk_login_history` table would close that gap. ~2 hours.

### Agent-side HB-50 mirror edge cases
The ticket→task comment mirror fires on customer messages + customer close AND agent messages + agent close. Still NOT mirrored:
- Agent edits their own message
- Agent-initiated reopen (the task's terminal-phase flip on close has no paired "reopened" task-side note)

### Worker trim job for helpdesk_ticket_events
`helpdesk_ticket_events` table is append-only with no TTL. A worker job to trim entries older than N days is documented as debt in the migration. ~3 hours.

### Worker SMTP env naming (known)
Worker's `env.ts` expects `SMTP_PASS` now — sanity-check that an end-to-end delivery test passes when SMTP is configured against a real relay.

### Board performance with many tasks
Mage test data has ~200 tasks and board render is fine. Larger projects (500-2000 tasks) haven't been stress-tested. Ties into Phase 7 virtualization.

---

## Intentionally deferred (non-goals for this generation)

- **Teams / groups** — users assigned to projects individually; no team abstraction
- **SSO / SCIM provisioning** — username+password only
- **2FA / TOTP** — scaffolded on login schema (`totp_code?`) but no enrollment/verify endpoints
- **Permission templates** — roles are fixed enums (owner/admin/member/viewer/guest); no per-permission toggles
- **Helpdesk customers management screen** — helpdesk_users is a parallel identity pool, not yet surfaced in the People UI
- **HB-5** — no `org_id` on `helpdesk_users` (single global customer pool); multi-tenant partitioning of the customer side is a design decision

---

## Recently flagged cosmetic items

### site/ is gitignored
The marketing site source (including the `UserManagement` section) lives under `site/` which is in `.gitignore`. Decide whether to track it in git. Currently building + deploying is manual via `site/upload.bat`.

### Test account credentials in CLAUDE.md drift from DB state
CLAUDE.md still has some references that don't match the live DB. Move to a non-committed `.env.test` or private notes doc.

### MCP tools path verification
The `agent.routes.ts` helpdesk paths moved behind `/helpdesk/agents` during HB-7 work. Verify no MCP tool or integration doc hardcoded the old path. ~15 min grep + fix.
