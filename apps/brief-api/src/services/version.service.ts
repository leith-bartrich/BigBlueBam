import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { briefVersions, briefDocuments } from '../db/schema/index.js';

export class VersionError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'VersionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export async function listVersions(documentId: string) {
  const versions = await db
    .select()
    .from(briefVersions)
    .where(eq(briefVersions.document_id, documentId))
    .orderBy(desc(briefVersions.version_number));

  // Strip yjs_state from list responses for size
  return versions.map((v) => ({
    ...v,
    yjs_state: undefined,
  }));
}

export async function getVersion(documentId: string, versionId: string) {
  const [version] = await db
    .select()
    .from(briefVersions)
    .where(
      and(
        eq(briefVersions.document_id, documentId),
        eq(briefVersions.id, versionId),
      ),
    )
    .limit(1);

  return version ?? null;
}

export interface CreateVersionInput {
  title?: string;
  change_summary?: string | null;
}

export async function createVersion(
  documentId: string,
  data: CreateVersionInput,
  userId: string,
  orgId: string,
) {
  // Get current document state
  const [doc] = await db
    .select()
    .from(briefDocuments)
    .where(and(eq(briefDocuments.id, documentId), eq(briefDocuments.org_id, orgId)))
    .limit(1);

  if (!doc) throw new VersionError('NOT_FOUND', 'Document not found', 404);

  // Determine next version number
  const [latestVersion] = await db
    .select({ version_number: briefVersions.version_number })
    .from(briefVersions)
    .where(eq(briefVersions.document_id, documentId))
    .orderBy(desc(briefVersions.version_number))
    .limit(1);

  const nextVersion = (latestVersion?.version_number ?? 0) + 1;

  const [version] = await db
    .insert(briefVersions)
    .values({
      document_id: documentId,
      version_number: nextVersion,
      title: data.title ?? doc.title,
      yjs_state: doc.yjs_state,
      html_snapshot: doc.html_snapshot,
      plain_text: doc.plain_text,
      word_count: doc.word_count,
      change_summary: data.change_summary ?? null,
      created_by: userId,
    })
    .returning();

  return version!;
}

export async function restoreVersion(
  documentId: string,
  versionId: string,
  userId: string,
  orgId: string,
) {
  // Verify document exists and belongs to org
  const [doc] = await db
    .select()
    .from(briefDocuments)
    .where(and(eq(briefDocuments.id, documentId), eq(briefDocuments.org_id, orgId)))
    .limit(1);

  if (!doc) throw new VersionError('NOT_FOUND', 'Document not found', 404);

  // Get the version to restore
  const [version] = await db
    .select()
    .from(briefVersions)
    .where(
      and(
        eq(briefVersions.document_id, documentId),
        eq(briefVersions.id, versionId),
      ),
    )
    .limit(1);

  if (!version) throw new VersionError('NOT_FOUND', 'Version not found', 404);

  // Update document with version content
  const [updated] = await db
    .update(briefDocuments)
    .set({
      title: version.title,
      yjs_state: version.yjs_state,
      html_snapshot: version.html_snapshot,
      plain_text: version.plain_text,
      word_count: version.word_count,
      updated_at: new Date(),
      updated_by: userId,
    })
    .where(eq(briefDocuments.id, documentId))
    .returning();

  // Create a new version snapshot to record the restore
  const [latestVersion] = await db
    .select({ version_number: briefVersions.version_number })
    .from(briefVersions)
    .where(eq(briefVersions.document_id, documentId))
    .orderBy(desc(briefVersions.version_number))
    .limit(1);

  const nextVersion = (latestVersion?.version_number ?? 0) + 1;

  await db.insert(briefVersions).values({
    document_id: documentId,
    version_number: nextVersion,
    title: version.title,
    yjs_state: version.yjs_state,
    html_snapshot: version.html_snapshot,
    plain_text: version.plain_text,
    word_count: version.word_count,
    change_summary: `Restored from version ${version.version_number}`,
    created_by: userId,
  });

  return updated!;
}
