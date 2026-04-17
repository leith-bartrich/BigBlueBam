import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { beaconComments, beaconEntries, users } from '../db/schema/index.js';
import { sanitizeHtml } from '../lib/sanitize.js';

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

/**
 * List comments for a beacon, joined with author display info. Caller is
 * responsible for verifying read access via requireBeaconReadAccess().
 * Results are ordered by created_at ASC so the frontend can flatten into
 * a thread tree in a single pass.
 */
export async function listComments(beaconId: string) {
  const rows = await db
    .select({
      id: beaconComments.id,
      beacon_id: beaconComments.beacon_id,
      parent_id: beaconComments.parent_id,
      author_id: beaconComments.author_id,
      body_markdown: beaconComments.body_markdown,
      body_html: beaconComments.body_html,
      created_at: beaconComments.created_at,
      updated_at: beaconComments.updated_at,
      author_name: users.display_name,
      author_email: users.email,
      author_avatar_url: users.avatar_url,
    })
    .from(beaconComments)
    .leftJoin(users, eq(users.id, beaconComments.author_id))
    .where(eq(beaconComments.beacon_id, beaconId))
    .orderBy(asc(beaconComments.created_at));

  return rows;
}

export interface CreateCommentInput {
  body_markdown: string;
  parent_id?: string | null;
}

/**
 * Create a comment on a beacon. If parent_id is supplied we verify the
 * parent belongs to the same beacon so replies cannot cross-link into
 * other discussions.
 */
export async function createComment(
  beaconId: string,
  authorId: string,
  input: CreateCommentInput,
) {
  if (input.parent_id) {
    const [parent] = await db
      .select({ id: beaconComments.id, beacon_id: beaconComments.beacon_id })
      .from(beaconComments)
      .where(eq(beaconComments.id, input.parent_id))
      .limit(1);
    if (!parent) {
      throw new CommentError('NOT_FOUND', 'Parent comment not found', 404);
    }
    if (parent.beacon_id !== beaconId) {
      throw new CommentError(
        'BAD_REQUEST',
        'Parent comment belongs to a different beacon',
        400,
      );
    }
  }

  // Minimal HTML rendering: wrap the markdown in a <p> block and sanitize.
  // Full markdown-to-HTML rendering is done client-side; we keep a sanitized
  // copy on the server for notification fallback and embeddings.
  const bodyHtml = sanitizeHtml(
    `<p>${input.body_markdown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</p>`,
  );

  const rows = await db
    .insert(beaconComments)
    .values({
      beacon_id: beaconId,
      parent_id: input.parent_id ?? null,
      author_id: authorId,
      body_markdown: input.body_markdown,
      body_html: bodyHtml,
    })
    .returning();

  const inserted = rows[0];
  if (!inserted) {
    throw new CommentError('INTERNAL_ERROR', 'Failed to create comment', 500);
  }
  return inserted;
}

export interface UpdateCommentInput {
  body_markdown: string;
}

/**
 * Update a comment. Only the original author may edit their comment.
 */
export async function updateComment(
  commentId: string,
  userId: string,
  input: UpdateCommentInput,
) {
  const [existing] = await db
    .select({
      id: beaconComments.id,
      author_id: beaconComments.author_id,
      beacon_id: beaconComments.beacon_id,
    })
    .from(beaconComments)
    .where(eq(beaconComments.id, commentId))
    .limit(1);

  if (!existing) {
    throw new CommentError('NOT_FOUND', 'Comment not found', 404);
  }
  if (existing.author_id !== userId) {
    throw new CommentError(
      'FORBIDDEN',
      'You can only edit your own comments',
      403,
    );
  }

  const bodyHtml = sanitizeHtml(
    `<p>${input.body_markdown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}</p>`,
  );

  const [updated] = await db
    .update(beaconComments)
    .set({
      body_markdown: input.body_markdown,
      body_html: bodyHtml,
      updated_at: new Date(),
    })
    .where(eq(beaconComments.id, commentId))
    .returning();

  return updated;
}

/**
 * Delete a comment. The author can always delete their own. Org admin/owner
 * and SuperUser bypass this check via the isAdmin flag.
 */
export async function deleteComment(
  commentId: string,
  userId: string,
  isAdmin: boolean,
) {
  const [existing] = await db
    .select({
      id: beaconComments.id,
      author_id: beaconComments.author_id,
      beacon_id: beaconComments.beacon_id,
    })
    .from(beaconComments)
    .where(eq(beaconComments.id, commentId))
    .limit(1);

  if (!existing) {
    throw new CommentError('NOT_FOUND', 'Comment not found', 404);
  }
  if (!isAdmin && existing.author_id !== userId) {
    throw new CommentError(
      'FORBIDDEN',
      'You can only delete your own comments',
      403,
    );
  }

  const [deleted] = await db
    .delete(beaconComments)
    .where(eq(beaconComments.id, commentId))
    .returning();

  return deleted;
}

/**
 * Load a comment with its beacon context so routes can enforce org/visibility
 * checks before calling delete/update.
 */
export async function getCommentWithBeacon(commentId: string) {
  const rows = await db
    .select({
      comment: beaconComments,
      beacon: beaconEntries,
    })
    .from(beaconComments)
    .innerJoin(beaconEntries, eq(beaconEntries.id, beaconComments.beacon_id))
    .where(eq(beaconComments.id, commentId))
    .limit(1);
  return rows[0] ?? null;
}
