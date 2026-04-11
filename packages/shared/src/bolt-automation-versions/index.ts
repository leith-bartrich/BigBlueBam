export const CURRENT_DATA_VERSION = 1 as const;

/**
 * A migrator takes a data payload at version N and returns it transformed
 * to version N+1. The array is ordered: MIGRATORS[0] migrates v1→v2,
 * MIGRATORS[1] migrates v2→v3, etc.
 */
export type Migrator<From = unknown, To = unknown> = (data: From) => To;

/**
 * Registry of migration functions. Currently empty — data_version=1 is
 * the only version in existence. When the first shape change lands:
 *
 *   1. Create `v2.ts` with `BoltAutomationDataV2`.
 *   2. Create `migrators/v1-to-v2.ts` exporting a `Migrator<BoltAutomationDataV1, BoltAutomationDataV2>`.
 *   3. Push the migrator into this array.
 *   4. Bump CURRENT_DATA_VERSION to 2.
 *   5. Add fixture pairs at `apps/bolt-api/test/fixtures/bolt-automation-versions/`.
 */
export const MIGRATORS: readonly Migrator<unknown, unknown>[] = [];

export type { BoltAutomationDataV1 } from './v1.js';
