import { db } from '../db/index.js';
import { superuserAuditLog } from '../db/schema/superuser-audit-log.js';

export interface LogSuperuserActionOpts {
  superuserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Writes a row to the `superuser_audit_log` table. Fire-and-forget friendly —
 * callers typically `await` this so the audit record lands before the
 * response is sent, but errors here should not cascade into the response.
 *
 * The physical table stores target information as two nullable columns:
 *   target_org_id, target_user_id
 * We route `targetId` into the right column based on `targetType`
 * ("org" / "organization" → target_org_id, "user" → target_user_id).
 * The full `{targetType, targetId, userAgent, ...opts.details}` payload is
 * also mirrored into the `details` JSONB column for forward-compatibility.
 */
export async function logSuperuserAction(opts: LogSuperuserActionOpts): Promise<void> {
  const { superuserId, action, targetType, targetId, details, ipAddress, userAgent } = opts;

  let target_org_id: string | null = null;
  let target_user_id: string | null = null;
  if (targetId) {
    const t = targetType?.toLowerCase() ?? '';
    if (t === 'org' || t === 'organization') {
      target_org_id = targetId;
    } else if (t === 'user') {
      target_user_id = targetId;
    }
  }

  const detailsPayload: Record<string, unknown> = {
    ...(targetType ? { target_type: targetType } : {}),
    ...(targetId ? { target_id: targetId } : {}),
    ...(userAgent ? { user_agent: userAgent } : {}),
    ...(details && typeof details === 'object' ? (details as Record<string, unknown>) : details !== undefined ? { value: details } : {}),
  };

  try {
    await db.insert(superuserAuditLog).values({
      superuser_id: superuserId,
      action,
      target_org_id,
      target_user_id,
      details: detailsPayload,
      ip_address: ipAddress ?? null,
    });
  } catch (err) {
    // Never let audit-log writes break a handler. Log and move on.
    // eslint-disable-next-line no-console
    console.warn('Failed to write superuser_audit_log row:', err);
  }
}
