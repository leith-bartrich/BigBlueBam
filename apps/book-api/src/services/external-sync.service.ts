import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bookExternalConnections, bookExternalEvents } from '../db/schema/index.js';
import { notFound, badRequest } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// List connections
// ---------------------------------------------------------------------------

export async function listConnections(userId: string) {
  const rows = await db
    .select()
    .from(bookExternalConnections)
    .where(eq(bookExternalConnections.user_id, userId))
    .orderBy(desc(bookExternalConnections.created_at));

  return { data: rows };
}

// ---------------------------------------------------------------------------
// Create connection (simplified — real impl would do OAuth flow)
// ---------------------------------------------------------------------------

export async function createConnection(
  userId: string,
  provider: string,
  accessToken: string,
  refreshToken: string | undefined,
  externalCalendarId: string,
  syncDirection?: string,
) {
  const [connection] = await db
    .insert(bookExternalConnections)
    .values({
      user_id: userId,
      provider,
      access_token: accessToken,
      refresh_token: refreshToken,
      external_calendar_id: externalCalendarId,
      sync_direction: syncDirection ?? 'both',
    })
    .returning();

  return connection!;
}

// ---------------------------------------------------------------------------
// Delete connection
// ---------------------------------------------------------------------------

export async function deleteConnection(id: string, userId: string) {
  const [deleted] = await db
    .delete(bookExternalConnections)
    .where(and(eq(bookExternalConnections.id, id), eq(bookExternalConnections.user_id, userId)))
    .returning({ id: bookExternalConnections.id });

  if (!deleted) throw notFound('Connection not found');
  return deleted;
}

// ---------------------------------------------------------------------------
// Force sync (placeholder — real impl would enqueue BullMQ job)
// ---------------------------------------------------------------------------

export async function forceSync(id: string, userId: string) {
  const [connection] = await db
    .select()
    .from(bookExternalConnections)
    .where(and(eq(bookExternalConnections.id, id), eq(bookExternalConnections.user_id, userId)))
    .limit(1);

  if (!connection) throw notFound('Connection not found');

  // Update last sync timestamp
  const [updated] = await db
    .update(bookExternalConnections)
    .set({
      last_sync_at: new Date(),
      sync_status: 'active',
      sync_error: null,
      updated_at: new Date(),
    })
    .where(eq(bookExternalConnections.id, id))
    .returning();

  return updated!;
}
