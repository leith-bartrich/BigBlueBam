# bolt-automation-versions

This directory holds the canonical type definitions and migration chain for `bolt_automations` data shapes.

## Pattern

Each version gets its own file: `v1.ts`, `v2.ts`, etc. Each file exports a `BoltAutomationDataVN` interface describing the full trigger/condition/action shape at that version.

`index.ts` exports:
- `CURRENT_DATA_VERSION` — the version new automations are written at.
- `MIGRATORS` — an ordered array of migrator functions. `MIGRATORS[0]` upgrades v1→v2, `MIGRATORS[1]` upgrades v2→v3, etc.
- Re-exports of all version types.

## Adding a new version

1. Create `v2.ts` with `BoltAutomationDataV2`.
2. Create `migrators/v1-to-v2.ts` exporting a `Migrator<BoltAutomationDataV1, BoltAutomationDataV2>` function.
3. Push the migrator into the `MIGRATORS` array in `index.ts`.
4. Bump `CURRENT_DATA_VERSION` to `2`.
5. Add fixture pairs at `apps/bolt-api/test/fixtures/bolt-automation-versions/v1-to-v2/`:
   - `input.json` — a sample `BoltAutomationDataV1` object
   - `expected.json` — the expected `BoltAutomationDataV2` output

## Runtime migration

The migrator chain runs on read in `automation.service.ts` whenever an automation's stored `data_version` is below `CURRENT_DATA_VERSION`. It does NOT write back automatically — the next save persists the migrated shape and bumps `data_version`.
