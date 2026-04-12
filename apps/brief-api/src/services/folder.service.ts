import crypto from 'node:crypto';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { briefFolders } from '../db/schema/index.js';

export class FolderError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'FolderError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  if (!base) return `folder-${crypto.randomBytes(4).toString('hex')}`;

  const [existing] = await db
    .select({ slug: briefFolders.slug })
    .from(briefFolders)
    .where(eq(briefFolders.slug, base))
    .limit(1);

  if (!existing) return base;

  return `${base}-${crypto.randomBytes(4).toString('hex')}`;
}

export interface CreateFolderInput {
  name: string;
  project_id?: string | null;
  parent_id?: string | null;
  sort_order?: number;
}

export async function createFolder(
  data: CreateFolderInput,
  userId: string,
  orgId: string,
) {
  const slug = await uniqueSlug(data.name);

  // Validate parent belongs to same org if provided
  if (data.parent_id) {
    const [parent] = await db
      .select({ org_id: briefFolders.org_id })
      .from(briefFolders)
      .where(eq(briefFolders.id, data.parent_id))
      .limit(1);

    if (!parent || parent.org_id !== orgId) {
      throw new FolderError('NOT_FOUND', 'Parent folder not found', 404);
    }
  }

  const [folder] = await db
    .insert(briefFolders)
    .values({
      org_id: orgId,
      project_id: data.project_id ?? null,
      parent_id: data.parent_id ?? null,
      name: data.name,
      slug,
      sort_order: data.sort_order ?? 0,
      created_by: userId,
    })
    .returning();

  return folder!;
}

export async function listFolders(orgId: string, projectId?: string) {
  const conditions = [eq(briefFolders.org_id, orgId)];

  if (projectId) {
    conditions.push(eq(briefFolders.project_id, projectId));
  }

  const folders = await db
    .select()
    .from(briefFolders)
    .where(and(...conditions))
    .orderBy(asc(briefFolders.sort_order), asc(briefFolders.name));

  return folders;
}

export interface UpdateFolderInput {
  name?: string;
  parent_id?: string | null;
  sort_order?: number;
}

export async function updateFolder(
  id: string,
  data: UpdateFolderInput,
  orgId: string,
) {
  const [existing] = await db
    .select()
    .from(briefFolders)
    .where(and(eq(briefFolders.id, id), eq(briefFolders.org_id, orgId)))
    .limit(1);

  if (!existing) throw new FolderError('NOT_FOUND', 'Folder not found', 404);

  // Prevent circular parent reference
  if (data.parent_id === id) {
    throw new FolderError('BAD_REQUEST', 'Folder cannot be its own parent', 400);
  }

  if (data.parent_id) {
    const [parent] = await db
      .select({ org_id: briefFolders.org_id })
      .from(briefFolders)
      .where(eq(briefFolders.id, data.parent_id))
      .limit(1);

    if (!parent || parent.org_id !== orgId) {
      throw new FolderError('NOT_FOUND', 'Parent folder not found', 404);
    }
  }

  const updateValues: Record<string, unknown> = {
    updated_at: new Date(),
  };

  if (data.name !== undefined) updateValues.name = data.name;
  if (data.parent_id !== undefined) updateValues.parent_id = data.parent_id;
  if (data.sort_order !== undefined) updateValues.sort_order = data.sort_order;

  const [folder] = await db
    .update(briefFolders)
    .set(updateValues)
    .where(eq(briefFolders.id, id))
    .returning();

  return folder!;
}

export async function deleteFolder(id: string, orgId: string) {
  const [existing] = await db
    .select()
    .from(briefFolders)
    .where(and(eq(briefFolders.id, id), eq(briefFolders.org_id, orgId)))
    .limit(1);

  if (!existing) throw new FolderError('NOT_FOUND', 'Folder not found', 404);

  const [deleted] = await db
    .delete(briefFolders)
    .where(eq(briefFolders.id, id))
    .returning();

  return deleted!;
}
