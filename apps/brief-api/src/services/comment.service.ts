import { eq, and, asc, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { briefComments, briefCommentReactions, briefDocuments, users } from '../db/schema/index.js';

export class CommentError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'CommentError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface CreateCommentInput {
  body: string;
  parent_id?: string | null;
  anchor_start?: Record<string, unknown> | null;
  anchor_end?: Record<string, unknown> | null;
  anchor_text?: string | null;
}

export async function createComment(
  documentId: string,
  data: CreateCommentInput,
  userId: string,
) {
  // If parent_id is set, verify it belongs to the same document
  if (data.parent_id) {
    const [parent] = await db
      .select({ document_id: briefComments.document_id })
      .from(briefComments)
      .where(eq(briefComments.id, data.parent_id))
      .limit(1);

    if (!parent || parent.document_id !== documentId) {
      throw new CommentError('NOT_FOUND', 'Parent comment not found', 404);
    }
  }

  const [comment] = await db
    .insert(briefComments)
    .values({
      document_id: documentId,
      parent_id: data.parent_id ?? null,
      author_id: userId,
      body: data.body,
      anchor_start: data.anchor_start ?? null,
      anchor_end: data.anchor_end ?? null,
      anchor_text: data.anchor_text ?? null,
    })
    .returning();

  return comment!;
}

export async function listComments(documentId: string) {
  const comments = await db
    .select({
      comment: briefComments,
      author_name: users.display_name,
      author_avatar: users.avatar_url,
    })
    .from(briefComments)
    .leftJoin(users, eq(users.id, briefComments.author_id))
    .where(eq(briefComments.document_id, documentId))
    .orderBy(asc(briefComments.created_at));

  // Build threaded structure
  const topLevel: any[] = [];
  const childMap = new Map<string, any[]>();

  for (const row of comments) {
    const item = {
      ...row.comment,
      author_name: row.author_name ?? null,
      author_avatar: row.author_avatar ?? null,
      replies: [] as any[],
    };

    if (!row.comment.parent_id) {
      topLevel.push(item);
    } else {
      const siblings = childMap.get(row.comment.parent_id) ?? [];
      siblings.push(item);
      childMap.set(row.comment.parent_id, siblings);
    }
  }

  // Attach replies to parents
  for (const parent of topLevel) {
    parent.replies = childMap.get(parent.id) ?? [];
  }

  return topLevel;
}

/** Verify a comment belongs to a document in the given org. Returns the comment or throws. */
async function verifyCommentOrg(commentId: string, orgId: string) {
  const [existing] = await db
    .select()
    .from(briefComments)
    .where(eq(briefComments.id, commentId))
    .limit(1);

  if (!existing) throw new CommentError('NOT_FOUND', 'Comment not found', 404);

  const [doc] = await db
    .select({ org_id: briefDocuments.org_id })
    .from(briefDocuments)
    .where(eq(briefDocuments.id, existing.document_id))
    .limit(1);

  if (!doc || doc.org_id !== orgId) {
    throw new CommentError('NOT_FOUND', 'Comment not found', 404);
  }

  return existing;
}

export async function updateComment(
  commentId: string,
  body: string,
  userId: string,
  orgId: string,
) {
  const existing = await verifyCommentOrg(commentId, orgId);

  if (existing.author_id !== userId) {
    throw new CommentError('FORBIDDEN', 'You can only edit your own comments', 403);
  }

  const [comment] = await db
    .update(briefComments)
    .set({
      body,
      updated_at: new Date(),
    })
    .where(eq(briefComments.id, commentId))
    .returning();

  return comment!;
}

export async function deleteComment(commentId: string, userId: string, isAdmin: boolean, orgId: string) {
  const existing = await verifyCommentOrg(commentId, orgId);

  if (existing.author_id !== userId && !isAdmin) {
    throw new CommentError('FORBIDDEN', 'You can only delete your own comments', 403);
  }

  const [deleted] = await db
    .delete(briefComments)
    .where(eq(briefComments.id, commentId))
    .returning();

  return deleted!;
}

export async function toggleResolve(commentId: string, userId: string, orgId: string) {
  const existing = await verifyCommentOrg(commentId, orgId);

  const newResolved = !existing.resolved;

  const [comment] = await db
    .update(briefComments)
    .set({
      resolved: newResolved,
      resolved_by: newResolved ? userId : null,
      updated_at: new Date(),
    })
    .where(eq(briefComments.id, commentId))
    .returning();

  return comment!;
}

export async function addReaction(commentId: string, userId: string, emoji: string) {
  const [reaction] = await db
    .insert(briefCommentReactions)
    .values({
      comment_id: commentId,
      user_id: userId,
      emoji,
    })
    .onConflictDoNothing({
      target: [
        briefCommentReactions.comment_id,
        briefCommentReactions.user_id,
        briefCommentReactions.emoji,
      ],
    })
    .returning();

  return reaction ?? null;
}

export async function removeReaction(commentId: string, userId: string, emoji: string) {
  const [deleted] = await db
    .delete(briefCommentReactions)
    .where(
      and(
        eq(briefCommentReactions.comment_id, commentId),
        eq(briefCommentReactions.user_id, userId),
        eq(briefCommentReactions.emoji, emoji),
      ),
    )
    .returning();

  return deleted ?? null;
}
