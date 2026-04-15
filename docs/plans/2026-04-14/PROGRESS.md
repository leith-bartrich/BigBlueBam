# 2026-04-14 Recovery Orchestration Progress Ledger

Live status tracker for the 2026-04-14 recovery orchestration push on branch `recovery`. Updated after every meaningful state change.

## Current phase

**Step 2 (Planning phase) - COMPLETE**

All 15 plans committed to recovery. Step 3 (Implementation orchestration) is next.

## Step 1 - Design audit phase - COMPLETE

All 14 design audits committed to `recovery` under `docs/design-audits/2026-04-14/`.

| Audit | Completion estimate | Merged in commit |
|---|---|---|
| Beacon | ~70-75% | `f33f31a` |
| Bearing | ~87% | `f33f31a` |
| Bench | ~85% | `f33f31a` |
| Bill | ~85-90% | `3cb07b4` |
| Blank | ~82% | `3cb07b4` |
| Blast | ~85% | `3cb07b4` |
| Board | ~68% | `62b1be5` |
| Bolt | ~80-85% | `62b1be5` |
| Bond | ~88% | `62b1be5` |
| Book | ~72% | `658be92` |
| Brief | ~62% | `658be92` |
| Banter | ~64% | `658be92` |
| Helpdesk | ~85-90% | `222b078` |
| Platform | ~84% | `222b078` |

## Step 2 - Planning phase - PENDING

Outputs to `docs/plans/2026-04-14/`. Each plan file consumes its corresponding audit file and produces a detailed implementation plan with gap IDs, migration claims, file paths, and verification steps.

| Plan | Audit source | Status | Migration claims | Committed |
|---|---|---|---|---|
| Beacon_Plan.md | Beacon_Design_Audit.md | **committed** | 0079, 0080 (+0081, 0082 reserve) | pending |
| Bearing_Plan.md | Bearing_Design_Audit.md | **committed** | 0083 (conditional) | pending |
| Bench_Plan.md | Bench_Design_Audit.md | **committed** | 0084, 0085 | pending |
| Bill_Plan.md | Bill_Design_Audit.md | **committed** | 0086, 0087, 0088 | pending |
| Blank_Plan.md | Blank_Design_Audit.md | **committed** | 0089, 0090 | pending |
| Blast_Plan.md | Blast_Design_Audit.md | **committed** | 0091, 0092 | pending |
| Board_Plan.md | Board_Design_Audit.md | **committed** | 0093 (+0094, 0095 reserve) | pending |
| Bolt_Plan.md | Bolt_Design_Audit.md | **committed** | 0096, 0097 (+0098 reserve) | pending |
| Bond_Plan.md | Bond_Design_Audit.md | **committed** | 0099, 0100 | pending |
| Book_Plan.md | Book_Design_Audit.md | **committed** | none (0101, 0102 reserve) | pending |
| Brief_Plan.md | Brief_Design_Audit.md | **committed** | 0103, 0104 | pending |
| Banter_Plan.md | Banter_Design_Audit.md | **committed** | 0105, 0106, 0107, 0108 | pending |
| Helpdesk_Plan.md | Helpdesk_Design_Audit.md | **committed** | 0109-0115 | pending |
| Platform_Plan.md | Platform_Design_Audit.md | **committed** | 0116, 0117, 0118, 0119 | pending |
| Cross_Product_Plan.md | all audits | **committed** | none (0120-0129 reserve) | pending |

## Step 3 - Implementation orchestration - IN PROGRESS (Wave 0)

Waves execute in dependency order.

| Wave | Items | Status |
|---|---|---|
| Wave 0.1 - Platform infra baseline | CI workflows, migrate bootstrap hook, biome unification | **already in tree at a8fb19a** |
| Wave 0.2 - MCP /tools/call HTTP route | Bolt_Plan G1 |  pending |
| Wave 0.3 - Canonical publishBoltEvent | packages/shared/src/bolt-events.ts created at 3b96332 | **partial** (file landed; 13 per-service copies still need refactor to re-export) |
| Wave 0.4 - Event naming sweep | Migration 0096 landed; apps/worker/src/jobs/bond-stale-deals.job.ts still emits prefixed name and uses old signature | **partial** |
| Wave 1 - Platform and shared schemas | RLS, OAuth, API key rotation, catalog entries, shared schemas, shared packages | pending |
| Wave 2 - Per-app implementations | 13 per-app plans | pending |
| Wave 3 - Cross-product integration | Cross-app linking, notification fan-out, integration harness | pending |
| Wave 4 - Housekeeping | CLAUDE.md refresh, POSTMORTEM.md, `recovery` to `main` promotion decision | pending |

## Wave 0 resume notes

**Wave 0.3 remaining work:** refactor each `apps/*/src/lib/bolt-events.ts` (13 files) plus `apps/worker/src/utils/bolt-events.ts` to re-export from `@bigbluebam/shared` instead of defining locally. The worker's current utility has a different argument shape (options object as 4th arg) and all call sites in `apps/worker/src/jobs/` pass that shape - those call sites also need renormalizing to the canonical 6+1-arg signature in the same commit.

**Wave 0.4 remaining work:** Migration 0096 is present and idempotent. Still needed: update `apps/worker/src/jobs/bond-stale-deals.job.ts:115` to emit `'deal.rotting'` instead of `'bond.deal.rotting'` and to use the canonical signature via `@bigbluebam/shared`. That change is coupled with the Wave 0.3 refactor of the worker's bolt-events utility, so they should land together.

**Wave 0.2 status:** the existing `apps/mcp-server/src/server.ts` at recovery tip was inspected during Step 2 planning but the `/tools/call` HTTP route was not implemented. See Bolt_Plan.md G1 for the full route skeleton including the microtask-ordering guard and service account bootstrap.

## Git state checkpoints

- Step 1 base: `a8fb19a` (fix(platform): reconcile Drizzle/SQL drift via migration 0078)
- Step 1 complete: `222b078` (all 14 audits + D-006 decision)
- Step 2 scaffolding: pending
- Step 2 complete: pending
- Wave 0 complete: pending
- Wave 1 complete: pending
- Wave 2 complete: pending
- Wave 3 complete: pending
- Wave 4 complete: pending

## Open blockers

None. Step 2 is clear to proceed.

## Known operational issues

- Detached-HEAD auto-recovery pattern in use per D-006. All orchestrator commits check `git branch --show-current` after `git commit` and cherry-pick back onto `recovery` if detached.
- Windows filesystem flakiness: pnpm install may need `--node-linker=hoisted --ignore-scripts`. `rm -rf` may fail on pnpm symlink farms; use `cmd.exe /c "rmdir /s /q"` for cleanup.
- No agent worktree isolation this run (D-002). All agents use the main `H:/BigBlueBam` checkout.
