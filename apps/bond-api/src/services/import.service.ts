import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bondImportMappings } from '../db/schema/index.js';
import { badRequest } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BondEntityType = 'contact' | 'company' | 'deal';

export interface CreateImportMappingInput {
  source_system: string;
  source_id: string;
  bond_entity_type: BondEntityType;
  bond_entity_id: string;
}

export interface LookupImportMappingInput {
  source_system: string;
  source_id: string;
}

// ---------------------------------------------------------------------------
// Create or upsert a single import mapping row
// ---------------------------------------------------------------------------

/**
 * Record an import mapping linking an external (source_system, source_id)
 * tuple to a Bond entity. The operation is idempotent at the DB level via the
 * unique (organization_id, source_system, source_id) constraint added in
 * migration 0099: repeat calls with the same key return the existing row
 * without creating a duplicate.
 */
export async function createImportMapping(
  orgId: string,
  input: CreateImportMappingInput,
) {
  if (!input.source_system.trim()) throw badRequest('source_system is required');
  if (!input.source_id.trim()) throw badRequest('source_id is required');
  if (!['contact', 'company', 'deal'].includes(input.bond_entity_type)) {
    throw badRequest('bond_entity_type must be one of contact, company, deal');
  }

  // onConflictDoUpdate gives us upsert semantics without two round-trips when
  // a caller replays the same source key (for example, re-running a partial
  // migration). We rewrite imported_at and bond_entity_id so the mapping
  // always points at the latest attempt.
  const [row] = await db
    .insert(bondImportMappings)
    .values({
      organization_id: orgId,
      source_system: input.source_system,
      source_id: input.source_id,
      bond_entity_type: input.bond_entity_type,
      bond_entity_id: input.bond_entity_id,
    })
    .onConflictDoUpdate({
      target: [
        bondImportMappings.organization_id,
        bondImportMappings.source_system,
        bondImportMappings.source_id,
      ],
      set: {
        bond_entity_type: input.bond_entity_type,
        bond_entity_id: input.bond_entity_id,
        imported_at: new Date(),
      },
    })
    .returning();

  return row!;
}

// ---------------------------------------------------------------------------
// Lookup — used by the import pipeline to dedupe before inserting entities
// ---------------------------------------------------------------------------

export async function lookupImportMapping(
  orgId: string,
  input: LookupImportMappingInput,
) {
  const [row] = await db
    .select()
    .from(bondImportMappings)
    .where(
      and(
        eq(bondImportMappings.organization_id, orgId),
        eq(bondImportMappings.source_system, input.source_system),
        eq(bondImportMappings.source_id, input.source_id),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// List mappings — scoped to an org, optionally filtered by source_system
// ---------------------------------------------------------------------------

export async function listImportMappings(
  orgId: string,
  options: { source_system?: string; limit?: number; offset?: number } = {},
) {
  const conditions = [eq(bondImportMappings.organization_id, orgId)];
  if (options.source_system) {
    conditions.push(eq(bondImportMappings.source_system, options.source_system));
  }

  const limit = Math.min(options.limit ?? 100, 500);
  const offset = options.offset ?? 0;

  const rows = await db
    .select()
    .from(bondImportMappings)
    .where(and(...conditions))
    .limit(limit)
    .offset(offset);

  return { data: rows, limit, offset };
}
