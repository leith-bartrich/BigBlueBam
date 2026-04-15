# BigBlueBam Design and Implementation Decisions

This file records design and implementation decisions the orchestrator has made autonomously during the 2026-04-14 recovery run. Each entry documents the concern, the options considered, the choice, and the rationale. The user can revisit any decision after the run by reading this file; reverting is usually possible because `recovery` is a single branch that can be rebased or reverted atomically.

New entries append to the end. Never edit or delete prior entries without explicit user instruction.

## D-001: Recovery branch strategy (2026-04-14)

**Concern.** After the 2026-04-13 attempt was rolled back to commit `a8fb19a`, the branch strategy needed to be redefined. The prior attempt used per-wave feature branches off `main` with PRs into `feature-completion-wip`, which required complex merge logic and produced 20+ stale worktrees that eventually blocked the Wave 2 dispatch. The user's new instruction is to "work out of the branch `recovery` until told otherwise" and "check in important files as you go."

**Options.**
- (a) Replicate the prior pattern: per-wave feature branches off `recovery`, merged back as fast-forward. Preserves atomicity per wave but reintroduces complexity.
- (b) Commit directly to `recovery` with every meaningful change, using commit messages to demarcate waves and sub-waves. Simpler, matches user instruction literally, defends against work loss.
- (c) Hybrid: commit directly to `recovery` for infrastructure and coordination work, use short-lived local branches only for agent-isolated work that must be verified before merging.

**Choice.** (b). Every orchestrator and agent commit lands directly on `recovery` and pushes. No PRs, no feature branches, no remote merge workflow. Each commit is a resumable checkpoint.

**Rationale.** The primary risk in the prior attempt was work loss from uncommitted state and tangled branch topology. Option (b) eliminates both by making every change a durable push. The downside (less atomic wave boundaries) is accepted because commit messages and `docs/plans/2026-04-14/PROGRESS.md` give sufficient wave tracking.

**Revert.** If the user wants per-wave atomic revert points, we can cherry-pick commits out of `recovery` into a new branch after the fact, or use `git revert <range>` to back out a wave. The commit messages enumerate wave boundaries to make this tractable.

## D-002: No agent worktree isolation during this run (2026-04-14)

**Concern.** The 2026-04-13 attempt used `isolation: "worktree"` on every parallel agent dispatch. This caused a cascade of Windows filesystem failures: stuck `index.lock` files, half-checked-out worktrees, locked branches that could not be deleted. By the time Wave 2 was dispatched, 12+ broken worktrees littered `.git/worktrees/` and every new dispatch failed at the "Updating files" step. The entire Wave 2 phase was blocked.

**Options.**
- (a) Retry worktree isolation with a smaller parallelism cap (2 or 3 at a time). Still filesystem-prone.
- (b) Abandon worktree isolation. All agents share the main `H:/BigBlueBam` checkout. Serialize any agent that writes files. Use parallelism only for read-only Explore agents.
- (c) Use physical clones under `C:/Users/eoffe/AppData/Local/Temp/bbb-*/` for parallel-capable agents. Isolates filesystem but costs ~500MB per clone.

**Choice.** (b) for the default path. Write-capable agents serialize through the main worktree; read-only research agents can parallelize. Option (c) stays available for cases where serialization would cost a full day of wall clock (primarily the 14 audit agents in Step 1 and any Wave 3 integration work).

**Rationale.** Filesystem race conditions are the proximate cause of the prior night's failure. Eliminating the shared-filesystem-lock problem is more important than throughput. Read-only parallelism is safe because reads do not take exclusive locks. Physical clones are a controlled escape hatch for when throughput genuinely matters.

**Revert.** None needed. If a later wave's throughput demands force a return to worktree isolation, we can revisit with a clean set of stale-worktree cleanup scripts.

## D-003: Migration numbering starts at 0079 (2026-04-14)

**Concern.** The 2026-04-13 attempt's `docs/plans/2026-04-13-revised/MIGRATION_LEDGER.md` reserved numbers 0047 through 0077 for various apps and platform items. None of those migration files were ever committed to a surviving branch. At `a8fb19a`, the highest committed migration is `0078_reconcile_bam_bearing_drift.sql`. The reserved ranges are stale.

**Options.**
- (a) Honor the old reserved ranges (0047-0077) and claim numbers from them as each plan needs one. Matches the prior attempt's mental model.
- (b) Ignore the old ranges. The new `docs/plans/2026-04-14/MIGRATION_LEDGER.md` starts claims at 0079 and assigns sequentially regardless of which app gets which number.
- (c) Re-reserve the old ranges in the new ledger but note they are now "free" and can be claimed by any plan.

**Choice.** (b). Fresh ledger, claims start at 0079, no legacy range allocation. Each plan claims numbers in the order plans are written, not per any pre-assigned app slot.

**Rationale.** Ranges 0047-0077 are a bookkeeping fiction at this point because the migrate runner only cares about what is on disk, and nothing with those numbers is on disk. Assigning sequentially from 0079 upward gives the new plans a clean sequence and avoids confusing future readers with 30 phantom numbers. The old ledger file at `docs/plans/2026-04-13-revised/MIGRATION_LEDGER.md` gets a "superseded" notice at the top during Step 1.

**Revert.** None needed.

## D-004: Stale 2026-04-13-revised ledger files marked superseded, not deleted (2026-04-14)

**Concern.** `docs/plans/2026-04-13-revised/DECISIONS.md` and `docs/plans/2026-04-13-revised/MIGRATION_LEDGER.md` still exist at `a8fb19a`. Their content is authentic (they were committed by agents during the prior attempt) but is now misleading because the branches and PRs they reference are deleted. Future readers could mistake them for current state.

**Options.**
- (a) Delete both files. Simpler tree, no risk of confusion.
- (b) Leave both files in place with no annotation. Preserves history but confuses readers.
- (c) Add a "superseded" notice at the top of each, pointing readers at the 2026-04-14 files, and leave the content intact for archaeology.

**Choice.** (c). Both files get a one-paragraph header noting they are historical artifacts of an attempt that was rolled back, and pointing at `docs/plans/2026-04-14/` for the current ledger. Done in Step 1 as a small bookkeeping commit.

**Rationale.** The prior attempt's decisions (D-002, D-003, D-005 through D-008, D-011, D-016) contain useful context and pattern documentation that the new orchestrator references when replicating Wave 0.2 (MCP transport), Wave 0.3 (bolt-events consolidation), Wave 1.A (RLS rollout), and so on. Deleting them loses that institutional memory. A superseded notice resolves the "is this current?" question without losing the history.

**Revert.** If the user decides the old files are too confusing and should be deleted outright, a later commit can remove them. The superseded notice protects against accidental mis-reading in the meantime.

## D-005: Step 1 audit dispatch uses parallel Explore agents with orchestrator-side writes (2026-04-14)

**Concern.** Step 1 needs to produce 14 per-app and platform audit documents. Doing them serially at 20-35 minutes each is 5-8 hours of wall clock. Doing them in parallel with `general-purpose` agents reintroduces worktree contention.

**Options.**
- (a) Serial `general-purpose` agents, each writing its own audit file and committing. Safe, slow.
- (b) Parallel `Explore` agents (read-only, so no filesystem contention) that return audit markdown as their report; orchestrator writes each to disk and commits. Fast, safe.
- (c) Parallel `general-purpose` agents in separate physical clones. Fast, uses disk.

**Choice.** (b). Launch up to 3 Explore agents in parallel per batch (5 batches of 2-3 agents for 14 audits). Each agent reads the codebase and design sources and returns audit markdown content up to 600-900 words. The orchestrator writes the content to the target path and commits. Orchestrator handles all writes; agents handle all research.

**Rationale.** Read-only parallelism is safe. Putting writes in the orchestrator centralizes commit discipline and keeps the "commit as you go" rule in one code path. Audit documents at 600-900 words are sufficient for the planning phase that consumes them — the audit template does not require deep prose, just structured lists and citations.

**Revert.** If the audit depth proves too thin, individual audits can be re-run through a deeper general-purpose agent that takes the Explore agent's draft as input and expands it. Alternatively the pattern flips to Option (a) or (c) for the remaining batches.

## D-006: Detached HEAD after commit auto-recovery pattern (2026-04-14 Step 1)

**Concern.** During Step 1, Batches 2 and 4 unexpectedly committed onto a detached HEAD at `a8fb19a` instead of branch `recovery`, despite `git branch --show-current` returning `recovery` immediately before the commit. Whatever mechanism is reparenting HEAD happens between the branch check and `git commit`, and the pattern repeats deterministically. Root cause is still unidentified (hypothesis: one of the harness's internal git operations temporarily detaches HEAD as part of agent orchestration, and my commits land in that detached state).

**Options.**
- (a) Diagnose the root cause before proceeding. Requires instrumenting git hooks or tracing harness behavior. High time cost, unclear success.
- (b) Accept the detachment as an environmental given, and bake auto-recovery into every commit. Each commit is followed by a branch check; if HEAD is detached, the commit is cherry-picked back onto `recovery` and the detached commit is abandoned.
- (c) Use `git commit --branch recovery` or similar. Git has no such flag; this option does not exist.
- (d) Force-move `recovery` to HEAD with `git branch -f recovery HEAD` after each commit. Fragile if `recovery` has advanced concurrently.

**Choice.** (b). Every commit in Step 1 Batch 5 onward uses a one-liner shell check: after `git commit`, check `git branch --show-current`. If it is not `recovery`, capture the commit SHA, `git checkout recovery`, `git cherry-pick <sha>`. Works deterministically without requiring understanding of what causes the detachment.

**Rationale.** The recovery is cheap (a single cherry-pick) and idempotent. The root cause investigation would consume significant context and time for marginal benefit. Auto-recovery keeps work on `recovery` regardless of what happens to HEAD in between commits.

**Revert.** None needed. If the detached-HEAD behavior stops happening on its own, the auto-recovery becomes a harmless no-op.

**Scope.** This pattern is used for the rest of Step 1, Step 2, and Step 3. Every commit that writes orchestrator-owned files or creates new tree state goes through the same pattern.

