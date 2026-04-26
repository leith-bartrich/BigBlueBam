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
// Integrity helpers
// ---------------------------------------------------------------------------

/**
 * Assert that `projectId` (if non-null) belongs to the same org as the
 * caller. Used at the service boundary by every code path that writes
 * `boards.project_id` so a buggy / stale client can't drop a foreign-org
 * project id into the table. Migration 0143 adds a DB trigger as
 * belt-and-suspenders, but raising the friendly BoardError here gives
 * clients a structured 400 response instead of a generic 500.
 *
 * Also enforces "user is allowed to attach a board to that project" — if
 * the user can see the project at all (project_memberships row exists OR
 * the project is in their org), we accept it; otherwise reject. This is
 * scoped permissively because the visibility filter on listBoards already
 * covers the "can the user SEE this board" question; we just want to
 * stop a SuperUser-impersonation-style escalation here.
 */
export async function assertProjectOrgAlignment(
  projectId: string | null | undefined,
  orgId: string,
): Promise<void> {
  if (!projectId) return;
  const [project] = await db
    .select({ org_id: projects.org_id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) {
    throw new BoardError('PROJECT_NOT_FOUND', `Project ${projectId} not found`, 404);
  }
  if (project.org_id !== orgId) {
    throw new BoardError(
      'PROJECT_ORG_MISMATCH',
      `Project ${projectId} belongs to a different organization than this board.`,
      400,
    );
  }
}

/**
 * Inspect a single board for known integrity issues. Today: just
 * cross-org project_id (the symptom that drove migration 0143). Designed
 * to grow — add additional checks as new corruption modes are
 * discovered, and the alert UX picks them up automatically as long as
 * each new check returns a unique `code`.
 */
export interface BoardIntegrityIssue {
  code: 'PROJECT_ORG_MISMATCH' | 'PROJECT_NOT_FOUND';
  message: string;
  details: Record<string, unknown>;
  remediations: ('detach' | 'reassign')[];
}

export async function checkBoardIntegrity(
  boardId: string,
  orgId: string,
): Promise<BoardIntegrityIssue[]> {
  const issues: BoardIntegrityIssue[] = [];

  const [board] = await db
    .select({
      id: boards.id,
      organization_id: boards.organization_id,
      project_id: boards.project_id,
    })
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.organization_id, orgId)))
    .limit(1);
  if (!board) return issues;

  if (board.project_id) {
    const [project] = await db
      .select({ org_id: projects.org_id, name: projects.name })
      .from(projects)
      .where(eq(projects.id, board.project_id))
      .limit(1);
    if (!project) {
      issues.push({
        code: 'PROJECT_NOT_FOUND',
        message: 'This board is attached to a project that no longer exists.',
        details: { project_id: board.project_id },
        remediations: ['detach', 'reassign'],
      });
    } else if (project.org_id !== board.organization_id) {
      issues.push({
        code: 'PROJECT_ORG_MISMATCH',
        message:
          "This board's project belongs to a different organization. Pick a project in this org or detach it.",
        details: {
          project_id: board.project_id,
          project_org_id: project.org_id,
          board_org_id: board.organization_id,
        },
        remediations: ['detach', 'reassign'],
      });
    }
  }

  return issues;
}

/**
 * Apply a remediation for a board integrity issue. Currently both actions
 * just patch project_id (detach → null, reassign → new id), but the
 * function exists as its own service entrypoint so the audit-log write
 * lives next to the mutation in a single transaction. Future remediations
 * (e.g. "purge orphaned board_elements rows after a yjs_state mismatch")
 * can plug in here.
 */
export async function remediateBoardIntegrity(args: {
  boardId: string;
  orgId: string;
  userId: string;
  action: { action: 'detach' } | { action: 'reassign'; project_id: string };
}): Promise<{ id: string; project_id: string | null }> {
  const existing = await getBoard(args.boardId, args.orgId);
  if (!existing) throw new BoardError('NOT_FOUND', 'Board not found', 404);

  let newProjectId: string | null;
  if (args.action.action === 'detach') {
    newProjectId = null;
  } else {
    // reassign — alignment-check before the DB trigger sees it so the
    // user gets a readable error instead of a CHECK violation.
    await assertProjectOrgAlignment(args.action.project_id, args.orgId);
    newProjectId = args.action.project_id;
  }

  const remediation =
    args.action.action === 'detach' ? 'user_detached' : 'user_reassigned';

  return await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(boards)
      .set({
        project_id: newProjectId,
        updated_at: new Date(),
        updated_by: args.userId,
      })
      .where(eq(boards.id, args.boardId))
      .returning({ id: boards.id, project_id: boards.project_id });

    await tx.execute(sql`
      INSERT INTO board_integrity_audit (board_id, issue_code, details, remediation)
      VALUES (
        ${args.boardId},
        ${args.action.action === 'detach' ? 'PROJECT_DETACHED' : 'PROJECT_REASSIGNED'},
        ${JSON.stringify({
          previous_project_id: existing.project_id,
          new_project_id: newProjectId,
          user_id: args.userId,
        })}::jsonb,
        ${remediation}
      )
    `);

    return updated!;
  });
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
      // Per-user star state for the requesting user. The list response goes
      // straight into the All Boards card grid which conditions the star
      // icon's fill on this boolean — without it, every card renders unstarred
      // regardless of the actual board_stars row state.
      starred: sql<boolean>`EXISTS (SELECT 1 FROM board_stars WHERE board_id = ${boards.id} AND user_id = ${filters.userId})`,
      // Inline integrity check so the All Boards card grid can render an
      // amber warning indicator without a per-card round-trip. Covers the
      // two known issue codes (PROJECT_ORG_MISMATCH, PROJECT_NOT_FOUND);
      // checkBoardIntegrity() is the source of truth and detail endpoint
      // for the exact issue list. A non-null project_id that resolves to
      // a project in a different org OR doesn't resolve at all counts as
      // 1; otherwise 0. CASE expression so a NULL project_id is always 0.
      integrity_issue_count: sql<number>`CASE
        WHEN ${boards.project_id} IS NULL THEN 0
        WHEN NOT EXISTS (SELECT 1 FROM projects WHERE id = ${boards.project_id}) THEN 1
        WHEN (SELECT org_id FROM projects WHERE id = ${boards.project_id}) <> ${boards.organization_id} THEN 1
        ELSE 0
      END`,
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
  // Reject up-front so the client gets a structured 400 instead of the DB
  // trigger's check_violation. The trigger from migration 0143 still
  // catches anything that bypasses the service layer.
  await assertProjectOrgAlignment(data.project_id, orgId);

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

  // Same alignment check on update — a PATCH with project_id from a
  // different org gets rejected before the DB trigger sees it.
  if (data.project_id !== undefined) {
    await assertProjectOrgAlignment(data.project_id, orgId);
  }

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

export async function permanentlyDeleteBoard(id: string, orgId: string) {
  const existing = await getBoard(id, orgId);
  if (!existing) throw new BoardError('NOT_FOUND', 'Board not found', 404);

  // Hard-delete. Dependent rows in board_elements / board_collaborators /
  // board_stars / board_versions are cleaned up via the FK ON DELETE CASCADE
  // declarations in their migrations; we don't enumerate them here so the
  // CASCADE remains the single source of truth.
  await db.delete(boards).where(eq(boards.id, id));
  return { id };
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

  // If the source board's project_id is misaligned (corrupted state,
  // pre-trigger), don't propagate the corruption. Detach the duplicate and
  // log; the user can re-attach via the alert UX.
  let projectIdForCopy = existing.project_id;
  if (projectIdForCopy) {
    try {
      await assertProjectOrgAlignment(projectIdForCopy, orgId);
    } catch {
      projectIdForCopy = null;
    }
  }

  return await db.transaction(async (tx) => {
    const [newBoard] = await tx
      .insert(boards)
      .values({
        organization_id: orgId,
        project_id: projectIdForCopy,
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

  const previousLocked = existing.locked;
  const [board] = await db
    .update(boards)
    .set({ locked: !previousLocked, updated_at: new Date(), updated_by: userId })
    .where(eq(boards.id, boardId))
    .returning();
  return { board: board!, previousLocked };
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
