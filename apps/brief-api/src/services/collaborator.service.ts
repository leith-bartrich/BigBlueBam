import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { briefCollaborators, briefDocuments, organizationMemberships, users } from '../db/schema/index.js';

export class CollaboratorError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'CollaboratorError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function listCollaborators(documentId: string) {
  const rows = await db
    .select({
      collaborator: briefCollaborators,
      user_name: users.display_name,
      user_email: users.email,
      user_avatar: users.avatar_url,
    })
    .from(briefCollaborators)
    .innerJoin(users, eq(users.id, briefCollaborators.user_id))
    .where(eq(briefCollaborators.document_id, documentId));

  return rows.map((r) => ({
    ...r.collaborator,
    user_name: r.user_name,
    user_email: r.user_email,
    user_avatar: r.user_avatar,
  }));
}

export interface AddCollaboratorInput {
  user_id: string;
  permission?: 'view' | 'comment' | 'edit';
}

export async function addCollaborator(
  documentId: string,
  data: AddCollaboratorInput,
  orgId: string,
) {
  // Verify the user exists
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, data.user_id))
    .limit(1);

  if (!user) {
    throw new CollaboratorError('NOT_FOUND', 'User not found', 404);
  }

  // Verify the target user belongs to the same org
  const [membership] = await db
    .select({ org_id: organizationMemberships.org_id })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.user_id, data.user_id),
        eq(organizationMemberships.org_id, orgId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new CollaboratorError('NOT_FOUND', 'User not found in this organization', 404);
  }

  const [collab] = await db
    .insert(briefCollaborators)
    .values({
      document_id: documentId,
      user_id: data.user_id,
      permission: data.permission ?? 'view',
    })
    .onConflictDoNothing({
      target: [briefCollaborators.document_id, briefCollaborators.user_id],
    })
    .returning();

  // If conflict (already exists), return the existing one
  if (!collab) {
    const [existing] = await db
      .select()
      .from(briefCollaborators)
      .where(
        and(
          eq(briefCollaborators.document_id, documentId),
          eq(briefCollaborators.user_id, data.user_id),
        ),
      )
      .limit(1);

    return existing!;
  }

  return collab;
}

export interface UpdateCollaboratorInput {
  permission: 'view' | 'comment' | 'edit';
}

/** Verify a collaborator belongs to a document in the given org. Returns the record or throws. */
async function verifyCollabOrg(collabId: string, orgId: string) {
  const [existing] = await db
    .select()
    .from(briefCollaborators)
    .where(eq(briefCollaborators.id, collabId))
    .limit(1);

  if (!existing) throw new CollaboratorError('NOT_FOUND', 'Collaborator not found', 404);

  const [doc] = await db
    .select({ org_id: briefDocuments.org_id })
    .from(briefDocuments)
    .where(eq(briefDocuments.id, existing.document_id))
    .limit(1);

  if (!doc || doc.org_id !== orgId) {
    throw new CollaboratorError('NOT_FOUND', 'Collaborator not found', 404);
  }

  return existing;
}

export async function updateCollaborator(
  collabId: string,
  data: UpdateCollaboratorInput,
  orgId: string,
) {
  await verifyCollabOrg(collabId, orgId);

  const [collab] = await db
    .update(briefCollaborators)
    .set({
      permission: data.permission,
      updated_at: new Date(),
    })
    .where(eq(briefCollaborators.id, collabId))
    .returning();

  return collab!;
}

export async function removeCollaborator(collabId: string, orgId: string) {
  await verifyCollabOrg(collabId, orgId);

  const [deleted] = await db
    .delete(briefCollaborators)
    .where(eq(briefCollaborators.id, collabId))
    .returning();

  return deleted ?? null;
}
