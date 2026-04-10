import { eq, and, or, sql, desc, lt, ilike, isNull, isNotNull, exists } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../db/index.js';
import {
  boards,
  boardElements,
  boardCollaborators,
  boardStars,
  boardTemplates,
  users,
  projects,
  projectMembers,
} from '../db/schema/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape LIKE/ILIKE metacharacters so user input is treated as literal text. */
export function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class BoardError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'BoardError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateBoardInput {
  name: string;
  description?: string | null;
  icon?: string | null;
  project_id?: string | null;
  template_id?: string | null;
  background?: string;
  visibility?: string;
  default_viewport?: unknown;
}

export interface UpdateBoardInput {
  name?: string;
  description?: string | null;
  icon?: string | null;
  project_id?: string | null;
  background?: string;
  visibility?: string;
  default_viewport?: unknown;
  thumbnail_url?: string | null;
}

export interface ListBoardFilters {
  orgId: string;
  userId: string;
  projectId?: string;
  visibility?: string;
  createdBy?: string;
  archived?: boolean;
  search?: string;
  cursor?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Visibility filter helper
// ---------------------------------------------------------------------------

/**
 * Builds a SQL condition that enforces visibility rules:
 * - 'organization' boards: visible to all org members (no extra filter needed)
 * - 'project' boards: visible to creator, collaborators, or project members
 * - 'private' boards: visible only to creator or collaborators
 */
function visibilityFilter(userId: string) {
  // A board is visible if:
  //   1. visibility = 'organization', OR
  //   2. created_by = userId, OR
  //   3. user is an explicit collaborator, OR
  //   4. visibility = 'project' AND user is a project member
  return or(
    eq(boards.visibility, 'organization'),
    eq(boards.created_by, userId),
    exists(
      db
        .select({ _: sql`1` })
        .from(boardCollaborators)
        .where(
          and(
            eq(boardCollaborators.board_id, boards.id),
            eq(boardCollaborators.user_id, userId),
          ),
        ),
    ),
    and(
      eq(boards.visibility, 'project'),
      exists(
        db
          .select({ _: sql`1` })
          .from(projectMembers)
          .where(
            and(
              eq(projectMembers.project_id, boards.project_id),
              eq(projectMembers.user_id, userId),
            ),
          ),
      ),
    ),
  )!;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listBoards(filters: ListBoardFilters) {
  const conditions = [eq(boards.organization_id, filters.orgId)];

  // Enforce visibility rules so users only see boards they have access to
  conditions.push(visibilityFilter(filters.userId));

  if (filters.projectId) conditions.push(eq(boards.project_id, filters.projectId));
  if (filters.visibility) conditions.push(eq(boards.visibility, filters.visibility));
  if (filters.createdBy) conditions.push(eq(boards.created_by, filters.createdBy));

  if (filters.archived === true) {
    conditions.push(isNotNull(boards.archived_at));
  } else {
    // Default: exclude archived
    conditions.push(isNull(boards.archived_at));
  }

  if (filters.search) {
    const escaped = escapeLike(filters.search);
    conditions.push(
      or(
        ilike(boards.name, `%${escaped}%`),
        ilike(boards.description, `%${escaped}%`),
      )!,
    );
  }

  const limit = Math.min(filters.limit ?? 50, 100);
  if (filters.cursor) conditions.push(lt(boards.updated_at, new Date(filters.cursor)));

  const rows = await db
    .select({
      id: boards.id,
      organization_id: boards.organization_id,
      project_id: boards.project_id,
      name: boards.name,
      description: boards.description,
      icon: boards.icon,
      thumbnail_url: boards.thumbnail_url,
      template_id: boards.template_id,
      background: boards.background,
      locked: boards.locked,
      visibility: boards.visibility,
      default_viewport: boards.default_viewport,
      created_by: boards.created_by,
      updated_by: boards.updated_by,
      created_at: boards.created_at,
      updated_at: boards.updated_at,
      archived_at: boards.archived_at,
      creator_name: users.display_name,
      project_name: projects.name,
      element_count: sql<number>`(SELECT COUNT(*)::int FROM board_elements WHERE board_id = ${boards.id})`,
      collaborator_count: sql<number>`(SELECT COUNT(*)::int FROM board_collaborators WHERE board_id = ${boards.id})`,
    })
    .from(boards)
    .leftJoin(users, eq(boards.created_by, users.id))
    .leftJoin(projects, eq(boards.project_id, projects.id))
    .where(and(...conditions))
    .orderBy(desc(boards.updated_at))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && data.length > 0 ? data[data.length - 1]!.updated_at.toISOString() : null;

  return { data, meta: { next_cursor: nextCursor, has_more: hasMore } };
}

export async function getBoard(id: string, orgId: string) {
  // Excludes yjs_state from response (too large)
  const [board] = await db
    .select({
      id: boards.id,
      organization_id: boards.organization_id,
      project_id: boards.project_id,
      name: boards.name,
      description: boards.description,
      icon: boards.icon,
      thumbnail_url: boards.thumbnail_url,
      template_id: boards.template_id,
      background: boards.background,
      locked: boards.locked,
      visibility: boards.visibility,
      default_viewport: boards.default_viewport,
      created_by: boards.created_by,
      updated_by: boards.updated_by,
      created_at: boards.created_at,
      updated_at: boards.updated_at,
      archived_at: boards.archived_at,
      creator_name: users.display_name,
      project_name: projects.name,
    })
    .from(boards)
    .leftJoin(users, eq(boards.created_by, users.id))
    .leftJoin(projects, eq(boards.project_id, projects.id))
    .where(and(eq(boards.id, id), eq(boards.organization_id, orgId)))
    .limit(1);

  return board ?? null;
}

export async function getBoardStats(id: string, orgId: string) {
  const result: any[] = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM board_elements WHERE board_id = ${id}) AS element_count,
      (SELECT COUNT(*)::int FROM board_collaborators WHERE board_id = ${id}) AS collaborator_count,
      b.updated_at AS last_updated
    FROM boards b
    WHERE b.id = ${id} AND b.organization_id = ${orgId}
  `);
  const row = result[0];
  if (!row) return null;
  return {
    element_count: row.element_count ?? 0,
    collaborator_count: row.collaborator_count ?? 0,
    last_updated: row.last_updated,
  };
}

export async function createBoard(data: CreateBoardInput, userId: string, orgId: string) {
  let yjsState: Buffer | null = null;
  if (data.template_id) {
    const [tpl] = await db
      .select({ yjs_state: boardTemplates.yjs_state })
      .from(boardTemplates)
      .where(eq(boardTemplates.id, data.template_id))
      .limit(1);
    if (tpl) yjsState = tpl.yjs_state;
  }

  const [board] = await db
    .insert(boards)
    .values({
      organization_id: orgId,
      project_id: data.project_id ?? null,
      name: data.name,
      description: data.description ?? null,
      icon: data.icon ?? null,
      template_id: data.template_id ?? null,
      background: data.background ?? 'dots',
      visibility: data.visibility ?? 'project',
      default_viewport: data.default_viewport ?? null,
      yjs_state: yjsState,
      created_by: userId,
      updated_by: userId,
    })
    .returning();

  return board!;
}

export async function updateBoard(
  id: string,
  data: UpdateBoardInput,
  userId: string,
  orgId: string,
) {
  const existing = await getBoard(id, orgId);
  if (!existing) throw new BoardError('NOT_FOUND', 'Board not found', 404);

  const updateValues: Record<string, unknown> = { updated_at: new Date(), updated_by: userId };
  if (data.name !== undefined) updateValues.name = data.name;
  if (data.description !== undefined) updateValues.description = data.description;
  if (data.icon !== undefined) updateValues.icon = data.icon;
  if (data.project_id !== undefined) updateValues.project_id = data.project_id;
  if (data.background !== undefined) updateValues.background = data.background;
  if (data.visibility !== undefined) updateValues.visibility = data.visibility;
  if (data.default_viewport !== undefined) updateValues.default_viewport = data.default_viewport;
  if (data.thumbnail_url !== undefined) updateValues.thumbnail_url = data.thumbnail_url;

  const [board] = await db.update(boards).set(updateValues).where(eq(boards.id, id)).returning();
  return board!;
}

export async function archiveBoard(id: string, userId: string, orgId: string) {
  const existing = await getBoard(id, orgId);
  if (!existing) throw new BoardError('NOT_FOUND', 'Board not found', 404);
  if (existing.archived_at) throw new BoardError('BAD_REQUEST', 'Board is already archived', 400);

  const [board] = await db
    .update(boards)
    .set({ archived_at: new Date(), updated_at: new Date(), updated_by: userId })
    .where(eq(boards.id, id))
    .returning();
  return board!;
}

export async function restoreBoard(id: string, userId: string, orgId: string) {
  const [existing] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, id), eq(boards.organization_id, orgId)))
    .limit(1);
  if (!existing) throw new BoardError('NOT_FOUND', 'Board not found', 404);
  if (!existing.archived_at) throw new BoardError('BAD_REQUEST', 'Board is not archived', 400);

  const [board] = await db
    .update(boards)
    .set({ archived_at: null, updated_at: new Date(), updated_by: userId })
    .where(eq(boards.id, id))
    .returning();
  return board!;
}

export async function duplicateBoard(id: string, userId: string, orgId: string) {
  const [existing] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, id), eq(boards.organization_id, orgId)))
    .limit(1);
  if (!existing) throw new BoardError('NOT_FOUND', 'Board not found', 404);

  return await db.transaction(async (tx) => {
    const [newBoard] = await tx
      .insert(boards)
      .values({
        organization_id: orgId,
        project_id: existing.project_id,
        name: `${existing.name} (copy)`,
        description: existing.description,
        icon: existing.icon,
        template_id: existing.template_id,
        background: existing.background,
        visibility: existing.visibility,
        default_viewport: existing.default_viewport,
        yjs_state: existing.yjs_state,
        created_by: userId,
        updated_by: userId,
      })
      .returning();

    // Copy elements
    const elements = await tx
      .select()
      .from(boardElements)
      .where(eq(boardElements.board_id, id));

    if (elements.length > 0) {
      await tx.insert(boardElements).values(
        elements.map((el) => ({
          id: crypto.randomUUID(),
          board_id: newBoard!.id,
          element_type: el.element_type,
          text_content: el.text_content,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation,
          color: el.color,
          font_size: el.font_size,
          frame_id: el.frame_id,
          group_id: el.group_id,
          arrow_start: el.arrow_start,
          arrow_end: el.arrow_end,
          arrow_label: el.arrow_label,
          embed_type: el.embed_type,
          embed_ref_id: el.embed_ref_id,
          embed_url: el.embed_url,
        })),
      );
    }

    return newBoard!;
  });
}

export async function toggleStar(boardId: string, userId: string) {
  const [existing] = await db
    .select({ id: boardStars.id })
    .from(boardStars)
    .where(and(eq(boardStars.board_id, boardId), eq(boardStars.user_id, userId)))
    .limit(1);

  if (existing) {
    await db.delete(boardStars).where(eq(boardStars.id, existing.id));
    return { starred: false };
  }

  await db.insert(boardStars).values({ board_id: boardId, user_id: userId });
  return { starred: true };
}

export async function toggleLock(boardId: string, userId: string, orgId: string) {
  const existing = await getBoard(boardId, orgId);
  if (!existing) throw new BoardError('NOT_FOUND', 'Board not found', 404);

  const [board] = await db
    .update(boards)
    .set({ locked: !existing.locked, updated_at: new Date(), updated_by: userId })
    .where(eq(boards.id, boardId))
    .returning();
  return board!;
}

export async function searchBoards(query: string, orgId: string, userId: string) {
  const escaped = escapeLike(query);

  const rows = await db
    .select({
      board_id: boards.id,
      board_name: boards.name,
      element_id: boardElements.id,
      element_type: boardElements.element_type,
      text_content: boardElements.text_content,
    })
    .from(boardElements)
    .innerJoin(boards, eq(boardElements.board_id, boards.id))
    .where(
      and(
        eq(boards.organization_id, orgId),
        isNull(boards.archived_at),
        ilike(boardElements.text_content, `%${escaped}%`),
        visibilityFilter(userId),
      ),
    )
    .orderBy(desc(boards.updated_at))
    .limit(50);

  return { data: rows };
}

export async function getStats(orgId: string, userId: string) {
  const result: any[] = await db.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE b.archived_at IS NULL)::int AS total,
      COUNT(*) FILTER (
        WHERE b.archived_at IS NULL
          AND b.updated_at > NOW() - INTERVAL '7 days'
      )::int AS recent,
      COUNT(*) FILTER (WHERE b.archived_at IS NOT NULL)::int AS archived,
      (SELECT COUNT(*)::int FROM board_stars bs
        JOIN boards b2 ON bs.board_id = b2.id
        WHERE b2.organization_id = ${orgId}
          AND bs.user_id = ${userId}
          AND b2.archived_at IS NULL
          AND (
            b2.visibility = 'organization'
            OR b2.created_by = ${userId}
            OR EXISTS (
              SELECT 1 FROM board_collaborators
              WHERE board_id = b2.id AND user_id = ${userId}
            )
            OR (b2.visibility = 'project' AND EXISTS (
              SELECT 1 FROM project_members
              WHERE project_id = b2.project_id AND user_id = ${userId}
            ))
          )
      ) AS starred
    FROM boards b
    WHERE b.organization_id = ${orgId}
      AND (
        b.visibility = 'organization'
        OR b.created_by = ${userId}
        OR EXISTS (
          SELECT 1 FROM board_collaborators
          WHERE board_id = b.id AND user_id = ${userId}
        )
        OR (b.visibility = 'project' AND EXISTS (
          SELECT 1 FROM project_members
          WHERE project_id = b.project_id AND user_id = ${userId}
        ))
      )
  `);

  const row = result[0] ?? { total: 0, recent: 0, archived: 0, starred: 0 };
  return row;
}

export async function getRecent(userId: string, orgId: string) {
  const rows = await db
    .select({
      id: boards.id,
      name: boards.name,
      icon: boards.icon,
      thumbnail_url: boards.thumbnail_url,
      updated_at: boards.updated_at,
      project_name: projects.name,
    })
    .from(boards)
    .leftJoin(projects, eq(boards.project_id, projects.id))
    .where(
      and(
        eq(boards.organization_id, orgId),
        isNull(boards.archived_at),
        visibilityFilter(userId),
      ),
    )
    .orderBy(desc(boards.updated_at))
    .limit(20);

  return { data: rows };
}

export async function getStarred(userId: string, orgId: string) {
  const rows = await db
    .select({
      id: boards.id,
      name: boards.name,
      icon: boards.icon,
      thumbnail_url: boards.thumbnail_url,
      updated_at: boards.updated_at,
      starred_at: boardStars.created_at,
      project_name: projects.name,
    })
    .from(boardStars)
    .innerJoin(boards, eq(boardStars.board_id, boards.id))
    .leftJoin(projects, eq(boards.project_id, projects.id))
    .where(
      and(
        eq(boardStars.user_id, userId),
        eq(boards.organization_id, orgId),
        isNull(boards.archived_at),
      ),
    )
    .orderBy(desc(boardStars.created_at))
    .limit(50);

  return { data: rows };
}
