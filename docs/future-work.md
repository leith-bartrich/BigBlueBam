# Future Work

Tracked items that are known-deferred or known-partial on the `granular-permissions` branch, with priority, rough scope, and suggested sequence.

Updated: 2026-04-05.

---

## P0 — Security or correctness gaps that should ship next

### Tighten audit-log status for items closed this session
Two just-landed security items (`HB-52 CSRF`, `HB-57 lockout`) are not yet reflected in `docs/helpdesk-bbb-audit-findings.md` — the status refresh agent ran in parallel with their implementation. A small verification pass should flip both to `RESOLVED` and drop the open count from 6 to 4. **~10 min.**

### Agent auth test-fixture gap
`apps/helpdesk-api/test/security.test.ts` was rewritten for the new per-agent key scheme and now has 13 passing executable tests plus **7 `it.todo` integration-test placeholders**. These cover end-to-end agent flows that need a real DB fixture (ticket creation, ownership enforcement, internal-note visibility). A proper integration test harness for helpdesk-api would close them. **~1 day.**

### `apps/api/src/plugins/auth.ts` request.log.warn touches request object
The argon2 try/catch hardening uses `request.log.warn` inside a loop that runs before `request.user` is set. Verify on every auth path that `request.log` is actually available at that point in the Fastify lifecycle (it should be — log is decorated by the framework, not by our plugin — but worth a trace).

---

## P1 — Known gaps flagged during audits, not yet shipped

### Helpdesk↔BBB audit (4 remaining open after this session)
- **HB-7** — Helpdesk writes directly to BBB tables with no service-auth boundary. Architectural; requires designing a dedicated internal API surface for helpdesk→BBB writes. **Large.**
- **HB-45** — No `ticket_activity_log` table; ticket status changes are not independently audited on the helpdesk side. **Medium** (schema + hook points).
- **HB-47** — Redis PubSub is not durable; offline WebSocket subscribers miss events. Consider migrating to a queue-backed fanout (BullMQ + a subscribers table). **Large.**
- **HB-55** — No duplicate/merge ticket support. New feature. **Medium-Large.**

### Permissions audit (12 remaining open)
Most are UI-layer gaps or middleware-vs-handler re-check items. Priority-ordered subset:
- **P1-19** (PARTIAL → should be RESOLVED) — deleted-guest session recheck. Verify fix landed then flip status.
- **P1-23** — API key scope mid-request revocation. Window is bounded by request duration; known tradeoff.
- **P1-25** — Concurrent role changes lack optimistic locking (no version column on memberships).
- **P1-30** — Guest invite token returned in response body (should be sent via email only). **Small** — wire SMTP delivery + return opaque ID.
- **P2-3 / P2-4** — Frontend shows setting toggles that aren't enforced server-side.
- **P2-16** — Migration script can leave NULL `org_id` on `users` if the backfill finds orphaned rows.
- **P2-17** — Scope enum drift: some sites use `'write'`, others `'read_write'`. Pick one canonically.
- **P2-23** — Org-setting re-check in some handlers after middleware has already validated.
- **P3-3** — Guest leave-channel role check.
- **P3-5** — Calls `/:id/participants` membership check.

### Routing quirk verification
`agent.routes.ts` was moved behind `/helpdesk/agents` this wave. Verify no external consumer (AI client, MCP tool, integration doc) hardcoded the old path. Grep MCP tools + doc examples.

### Helpdesk agent-side HB-50 mirror edge cases
The agent mirror now fires on `POST /messages`, `POST /close`, and `PATCH /status=closed`. Edge cases to verify:
- Agent edits their own message (if that's a supported op) — currently NOT mirrored.
- Agent-initiated reopen — currently NOT mirrored; the task's terminal-phase flip on close has no corresponding "ticket reopened" task-side comment.

---

## P2 — Quality-of-life / technical debt

### Migration-based admin endpoint consolidation
`apps/api/src/routes/api-key.routes.ts` and the CLI `create-api-key` now both require `--org-slug` (P2-8 fix). The UI api-key create form also needs to expose the org picker — verify the `settings.tsx` modal still works or needs updating. **~30 min.**

### `env.ts` cleanup across helpdesk-api
`apps/helpdesk-api/src/env.ts` has accumulated vestigial entries through the audit waves. Small pass to prune anything unread by any `*.ts` file in the helpdesk-api tree. **~15 min.**

### `tsconfig` rootDir fix for `packages/shared`
Pre-existing typecheck errors in `apps/api` and `apps/banter-api` complain about `packages/shared` being outside rootDir. Harmless in practice (tsup builds fine) but noisy in CI. Either adjust the referenced tsconfig or split rootDir handling. **~30 min — 1 hour depending on approach.**

### Frontend auth store error shape is now heterogeneous
`useAuthStore.error` is structured (`{message, cause?, requestId?}`) but `useBoardStore.error` is still `string | null`. Consider unifying across all stores for consistent error UX. **~1 hour.**

### `docs/api-reference.md` Banter API coverage gap
Banter API is not documented in `api-reference.md` at all (pre-existing gap flagged in this session). The branch's changes to Banter are hardening (membership guards, DM target validation) rather than new endpoint paths, so the initial doc work would be a straight enumeration. **~half day.**

---

## P3 — Nice to have

### Expand-contract deprecation of `users.org_id`
The column is currently load-bearing (auth plugin fallback when no memberships exist) but conceptually replaced by `organization_memberships`. A migration could backfill any remaining orphans and drop the column. **Medium** — must audit every read site.

### `MIGRATE_ALLOW_HEADER_RESTAMP` one-time flag
Was added as a rescue path when migration headers were retroactively added. Once all deployed environments have been stamped with the new body-checksum hashes, the flag can be removed. **~15 min + coordination.**

### CLI wrapper for key revocation
The CLI can mint `bbam_` and `hdag_` keys, but revoking requires SQL (`UPDATE helpdesk_agent_api_keys SET revoked_at = now()` or `DELETE FROM api_keys`). Add `revoke-api-key --prefix <8chars>` and `revoke-helpdesk-agent-key --prefix <8chars>`. **~30 min.**

---

## Deferred (explicit do-not-do for now)

- **HB-5** (no `org_id` on `helpdesk_users`, single global customer pool): deferred because customer-side multi-tenant partition is a design decision that affects onboarding, email verification scope, and rate-limit keying.
- **HB-7** (helpdesk direct-write to BBB tables): the architectural fix is real work and should be planned separately.
