import { db } from '../db/index.js';
import { banterAuditLog } from '../db/schema/audit-log.js';

export interface AuditEntry {
  org_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, unknown> | null;
}

/**
 * Insert a row into banter_audit_log.
 * Fire-and-forget safe -- callers can `.catch(() => {})` if they don't
 * want audit failures to break the main flow.
 */
export async function logAudit(entry: AuditEntry) {
  const [row] = await db
    .insert(banterAuditLog)
    .values({
      org_id: entry.org_id,
      user_id: entry.user_id,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      details: entry.details ?? null,
    })
    .returning();

  return row!;
}
