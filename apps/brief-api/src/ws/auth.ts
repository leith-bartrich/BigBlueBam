import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  briefDocuments,
  briefCollaborators,
  projectMemberships,
} from '../db/schema/index.js';

// ---------------------------------------------------------------------------
// WebSocket-specific document access checker
//
// The HTTP middleware (authorize.ts) couples tightly to FastifyRequest/Reply.
// This module provides the same access logic but returns a plain object so the
// WS handler can call it without fabricating a request envelope.
// ---------------------------------------------------------------------------

const ROLE_HIERARCHY = ['viewer', 'member', 'admin', 'owner'] as const;

function roleLevel(role: string): number {
  const idx = ROLE_HIERARCHY.indexOf(role as (typeof ROLE_HIERARCHY)[number]);
  return idx >= 0 ? idx : -1;
}

export interface WsAccessResult {
  hasAccess: boolean;
  canEdit: boolean;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Determines whether the given user can connect to a document's collaboration
 * room and whether they have edit permissions.
 */
export async function checkDocumentAccessForWs(
  docIdOrSlug: string,
  userId: string,
  orgId: string,
  userRole: string,
  isSuperuser: boolean,
): Promise<WsAccessResult> {
  const deny: WsAccessResult = { hasAccess: false, canEdit: false };

  const isUuid = UUID_REGEX.test(docIdOrSlug);
  const condition = isUuid
    ? eq(briefDocuments.id, docIdOrSlug)
    : eq(briefDocuments.slug, docIdOrSlug);

  const [doc] = await db
    .select({
      id: briefDocuments.id,
      org_id: briefDocuments.org_id,
      project_id: briefDocuments.project_id,
      visibility: briefDocuments.visibility,
      created_by: briefDocuments.created_by,
      archived_at: briefDocuments.archived_at,
    })
    .from(briefDocuments)
    .where(condition)
    .limit(1);

  if (!doc) return deny;
  if (doc.archived_at) return deny;

  // Org isolation
  if (doc.org_id !== orgId && !isSuperuser) return deny;

  // SuperUsers always have full access
  if (isSuperuser) return { hasAccess: true, canEdit: true };

  // Admin / Owner org role can always edit
  if (roleLevel(userRole) >= roleLevel('admin')) {
    return { hasAccess: true, canEdit: true };
  }

  // Creator always has full access
  if (doc.created_by === userId) {
    return { hasAccess: true, canEdit: true };
  }

  // Check explicit collaborator
  const [collab] = await db
    .select({ permission: briefCollaborators.permission })
    .from(briefCollaborators)
    .where(
      and(
        eq(briefCollaborators.document_id, doc.id),
        eq(briefCollaborators.user_id, userId),
      ),
    )
    .limit(1);

  if (collab) {
    return { hasAccess: true, canEdit: collab.permission === 'edit' };
  }

  // Organization visibility: any org member can read and edit
  if (doc.visibility === 'organization') {
    return { hasAccess: true, canEdit: true };
  }

  // Project visibility: project members can read and edit
  if (doc.visibility === 'project' && doc.project_id) {
    const [membership] = await db
      .select({ id: projectMemberships.id })
      .from(projectMemberships)
      .where(
        and(
          eq(projectMemberships.project_id, doc.project_id),
          eq(projectMemberships.user_id, userId),
        ),
      )
      .limit(1);

    if (membership) return { hasAccess: true, canEdit: true };
  }

  return deny;
}
