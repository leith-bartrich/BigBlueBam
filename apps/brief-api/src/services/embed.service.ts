import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { briefEmbeds, briefDocuments } from '../db/schema/index.js';

export class EmbedError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 400) {
    super(message);
    this.name = 'EmbedError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export interface CreateEmbedInput {
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_key: string;
  width?: number | null;
  height?: number | null;
}

export async function createEmbed(
  documentId: string,
  data: CreateEmbedInput,
  userId: string,
) {
  const [embed] = await db
    .insert(briefEmbeds)
    .values({
      document_id: documentId,
      file_name: data.file_name,
      file_size: data.file_size,
      mime_type: data.mime_type,
      storage_key: data.storage_key,
      width: data.width ?? null,
      height: data.height ?? null,
      uploaded_by: userId,
    })
    .returning();

  return embed!;
}

export async function listEmbeds(documentId: string) {
  const embeds = await db
    .select()
    .from(briefEmbeds)
    .where(eq(briefEmbeds.document_id, documentId));

  return embeds;
}

export async function deleteEmbed(embedId: string, orgId: string) {
  // Verify the embed's parent document belongs to the caller's org
  const [embed] = await db
    .select({ id: briefEmbeds.id, document_id: briefEmbeds.document_id })
    .from(briefEmbeds)
    .where(eq(briefEmbeds.id, embedId))
    .limit(1);

  if (!embed) return null;

  const [doc] = await db
    .select({ org_id: briefDocuments.org_id })
    .from(briefDocuments)
    .where(eq(briefDocuments.id, embed.document_id))
    .limit(1);

  if (!doc || doc.org_id !== orgId) return null;

  const [deleted] = await db
    .delete(briefEmbeds)
    .where(eq(briefEmbeds.id, embedId))
    .returning();

  return deleted ?? null;
}

/**
 * Generate a unique storage key for an uploaded file.
 */
export function generateStorageKey(documentId: string, fileName: string): string {
  const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
  const random = crypto.randomBytes(8).toString('hex');
  return `brief/${documentId}/${random}${ext ? `.${ext}` : ''}`;
}
