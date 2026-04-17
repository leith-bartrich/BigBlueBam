import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tickets } from '../db/schema/tickets.js';
import { projects } from '../db/schema/bbb-refs.js';

/**
 * Resolve the owning org_id for a ticket by walking tickets.project_id
 * → projects.org_id. Returns null when the ticket has no project linkage
 * (a helpdesk customer may submit a ticket before an admin has configured
 * default_project_id in helpdesk_settings). Bolt event emission swallows
 * nulls - no org means no multi-tenant event surface to publish to.
 */
export async function resolveTicketOrgId(ticketId: string): Promise<string | null> {
  const [row] = await db
    .select({ org_id: projects.org_id })
    .from(tickets)
    .innerJoin(projects, eq(projects.id, tickets.project_id))
    .where(eq(tickets.id, ticketId))
    .limit(1);
  return (row?.org_id as string | undefined) ?? null;
}
