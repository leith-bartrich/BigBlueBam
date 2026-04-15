# 2026-04-14 Migration Number Ledger

Authoritative registry of migration numbers for the 2026-04-14 recovery orchestration push. Claims start at **0079** (the committed tree at `a8fb19a` has `0078_reconcile_bam_bearing_drift.sql` as the highest migration). All numbers 0047 through 0077 are unclaimed at a8fb19a and are available from 0079 onward.

## Claim policy

- Each per-app or platform plan in `docs/plans/2026-04-14/` declares its migration needs in its "Migrations" section, with specific numbers claimed from this ledger.
- Claim numbers sequentially. When a plan is committed, update this ledger in the **same commit** to record the claim.
- Migration filenames must match `^[0-9]{4}_[a-z][a-z0-9_]*\.sql$`.
- Every migration must be idempotent and carry the `-- Why:` / `-- Client impact:` header.
- Never edit a committed migration file.

## Claimed / assigned

| Number | File | Plan | Wave | Status |
|---|---|---|---|---|
| _(none yet)_ | | | | |

## Overflow pool

If two plans need the same number due to simultaneous claims during Step 2 planning, the plan committed second claims the next sequential number and updates its own Migrations section accordingly. The orchestrator reconciles at merge time.

## Stale ledger reference

`docs/plans/2026-04-13-revised/MIGRATION_LEDGER.md` is from the rolled-back 2026-04-13 attempt. It reserved numbers 0047-0077 but none of those migrations were ever committed to a surviving branch. Treat that ledger as archaeology, not authority. Per DECISIONS.md D-003, the new ledger starts fresh at 0079.
