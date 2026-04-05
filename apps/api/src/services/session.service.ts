import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sessions } from '../db/schema/sessions.js';

/**
 * Updates the session row's active_org_id. Pass `null` to clear it.
 *
 * This is used by the "switch active organization" endpoint to persist
 * the user's currently-selected organization on the server side, so it
 * survives across requests and WebSocket connections without depending
 * on the client echoing X-Org-Id on every call.
 *
 * Note: callers should validate that the user is actually a member of
 * `orgId` BEFORE calling this helper — this function performs no
 * authorization checks of its own.
 */
export async function setActiveOrgId(
  sessionId: string,
  orgId: string | null,
): Promise<void> {
  await db
    .update(sessions)
    .set({ active_org_id: orgId })
    .where(eq(sessions.id, sessionId));
}

/**
 * Clears the session's active_org_id, reverting to header/default-based
 * org resolution on subsequent requests.
 */
export async function clearActiveOrgId(sessionId: string): Promise<void> {
  await setActiveOrgId(sessionId, null);
}
