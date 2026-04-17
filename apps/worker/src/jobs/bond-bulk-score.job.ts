/**
 * Bond bulk lead-score recalculation worker.
 *
 * Re-scores all contacts in an organization (or a specific org if provided)
 * using the existing lead scoring rules. Triggered on demand or as a daily
 * scheduled job at 05:00 UTC.
 *
 * For each organization, fetches all enabled scoring rules, then iterates
 * through all non-deleted contacts, evaluates each rule, and updates the
 * cached lead_score on the contact row.
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BondBulkScoreJobData {
  /** When provided, only re-score contacts in this org. */
  organization_id?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function evaluateCondition(
  fieldValue: unknown,
  operator: string,
  conditionValue: string,
): boolean {
  const strValue = fieldValue != null ? String(fieldValue) : '';

  switch (operator) {
    case 'equals':
      return strValue === conditionValue;
    case 'not_equals':
      return strValue !== conditionValue;
    case 'contains':
      return strValue.toLowerCase().includes(conditionValue.toLowerCase());
    case 'gt': {
      const a = Number(fieldValue), b = Number(conditionValue);
      return !isNaN(a) && !isNaN(b) && a > b;
    }
    case 'lt': {
      const a = Number(fieldValue), b = Number(conditionValue);
      return !isNaN(a) && !isNaN(b) && a < b;
    }
    case 'gte': {
      const a = Number(fieldValue), b = Number(conditionValue);
      return !isNaN(a) && !isNaN(b) && a >= b;
    }
    case 'lte': {
      const a = Number(fieldValue), b = Number(conditionValue);
      return !isNaN(a) && !isNaN(b) && a <= b;
    }
    case 'exists':
      return fieldValue != null && fieldValue !== '';
    case 'not_exists':
      return fieldValue == null || fieldValue === '';
    default:
      return false;
  }
}

function resolveFieldValue(contact: Record<string, unknown>, fieldPath: string): unknown {
  if (fieldPath.startsWith('custom_fields.')) {
    const key = fieldPath.slice('custom_fields.'.length);
    const cf = (contact.custom_fields ?? {}) as Record<string, unknown>;
    return cf[key];
  }
  return contact[fieldPath];
}

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

export async function processBondBulkScoreJob(
  job: Job<BondBulkScoreJobData>,
  logger: Logger,
): Promise<void> {
  const db = getDb();
  const { organization_id } = job.data;

  // Get distinct org IDs to process
  let orgIds: string[];
  if (organization_id) {
    orgIds = [organization_id];
  } else {
    const orgs: any[] = await db.execute(
      sql`SELECT DISTINCT organization_id FROM bond_contacts WHERE deleted_at IS NULL LIMIT 1000`,
    );
    orgIds = orgs.map((r: any) => r.organization_id);
  }

  logger.info({ orgCount: orgIds.length }, 'bond-bulk-score: starting');

  let totalScored = 0;

  for (const orgId of orgIds) {
    // Load enabled rules for this org
    const rules: any[] = await db.execute(
      sql`SELECT id, condition_field, condition_operator, condition_value, score_delta
          FROM bond_lead_scoring_rules
          WHERE organization_id = ${orgId} AND enabled = true`,
    );

    if (rules.length === 0) {
      logger.debug({ orgId }, 'bond-bulk-score: no enabled rules, skipping org');
      continue;
    }

    // Process contacts in batches
    let offset = 0;
    const batchSize = 200;

    while (true) {
      const contacts: any[] = await db.execute(
        sql`SELECT id, first_name, last_name, email, phone, title,
                   lifecycle_stage, lead_source, custom_fields
            FROM bond_contacts
            WHERE organization_id = ${orgId} AND deleted_at IS NULL
            ORDER BY id
            LIMIT ${batchSize} OFFSET ${offset}`,
      );

      if (contacts.length === 0) break;

      for (const contact of contacts) {
        let score = 0;
        for (const rule of rules) {
          const fieldValue = resolveFieldValue(contact, rule.condition_field);
          if (evaluateCondition(fieldValue, rule.condition_operator, rule.condition_value)) {
            score += rule.score_delta;
          }
        }

        // Clamp to 0-100
        score = Math.max(0, Math.min(100, score));

        await db.execute(
          sql`UPDATE bond_contacts SET lead_score = ${score}, updated_at = NOW()
              WHERE id = ${contact.id}`,
        );
        totalScored++;
      }

      offset += batchSize;
    }
  }

  logger.info({ totalScored, orgCount: orgIds.length }, 'bond-bulk-score: completed');
}
