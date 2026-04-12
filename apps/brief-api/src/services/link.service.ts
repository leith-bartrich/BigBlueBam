import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  briefTaskLinks,
  briefBeaconLinks,
  briefDocuments,
  tasks,
  beaconEntries,
} from '../db/schema/index.js';

export class LinkError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'LinkError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Task Links
// ---------------------------------------------------------------------------

export async function createTaskLink(
  documentId: string,
  taskId: string,
  linkType: 'reference' | 'spec' | 'notes' | 'postmortem',
  userId: string,
  orgId: string,
) {
  // Verify document belongs to org
  const [doc] = await db
    .select({ org_id: briefDocuments.org_id })
    .from(briefDocuments)
    .where(eq(briefDocuments.id, documentId))
    .limit(1);

  if (!doc || doc.org_id !== orgId) return null;

  // Verify task belongs to same org
  const [task] = await db
    .select({ org_id: tasks.org_id })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task || task.org_id !== orgId) return null;

  const [link] = await db
    .insert(briefTaskLinks)
    .values({
      document_id: documentId,
      task_id: taskId,
      link_type: linkType,
      created_by: userId,
    })
    .onConflictDoNothing({
      target: [briefTaskLinks.document_id, briefTaskLinks.task_id, briefTaskLinks.link_type],
    })
    .returning();

  return link ?? null;
}

// ---------------------------------------------------------------------------
// Beacon Links
// ---------------------------------------------------------------------------

export async function createBeaconLink(
  documentId: string,
  beaconId: string,
  linkType: 'reference' | 'source' | 'related',
  userId: string,
  orgId: string,
) {
  // Verify document belongs to org
  const [doc] = await db
    .select({ org_id: briefDocuments.org_id })
    .from(briefDocuments)
    .where(eq(briefDocuments.id, documentId))
    .limit(1);

  if (!doc || doc.org_id !== orgId) return null;

  // Verify beacon belongs to same org
  const [beacon] = await db
    .select({ organization_id: beaconEntries.organization_id })
    .from(beaconEntries)
    .where(eq(beaconEntries.id, beaconId))
    .limit(1);

  if (!beacon || beacon.organization_id !== orgId) return null;

  const [link] = await db
    .insert(briefBeaconLinks)
    .values({
      document_id: documentId,
      beacon_id: beaconId,
      link_type: linkType,
      created_by: userId,
    })
    .onConflictDoNothing({
      target: [briefBeaconLinks.document_id, briefBeaconLinks.beacon_id, briefBeaconLinks.link_type],
    })
    .returning();

  return link ?? null;
}

// ---------------------------------------------------------------------------
// List & Delete
// ---------------------------------------------------------------------------

export async function getLinks(documentId: string) {
  const taskLinks = await db
    .select()
    .from(briefTaskLinks)
    .where(eq(briefTaskLinks.document_id, documentId));

  const beaconLinks = await db
    .select()
    .from(briefBeaconLinks)
    .where(eq(briefBeaconLinks.document_id, documentId));

  return {
    task_links: taskLinks,
    beacon_links: beaconLinks,
  };
}

export async function deleteLink(linkId: string, documentId: string) {
  // Try task links first
  const [taskDeleted] = await db
    .delete(briefTaskLinks)
    .where(
      and(
        eq(briefTaskLinks.id, linkId),
        eq(briefTaskLinks.document_id, documentId),
      ),
    )
    .returning();

  if (taskDeleted) return taskDeleted;

  // Try beacon links
  const [beaconDeleted] = await db
    .delete(briefBeaconLinks)
    .where(
      and(
        eq(briefBeaconLinks.id, linkId),
        eq(briefBeaconLinks.document_id, documentId),
      ),
    )
    .returning();

  return beaconDeleted ?? null;
}
