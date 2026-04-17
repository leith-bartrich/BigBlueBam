import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { briefDocuments } from '../db/schema/index.js';
import { publishBoltEvent } from '../lib/bolt-events.js';

// ---------------------------------------------------------------------------
// Embedding / Qdrant sync service (Wave 2 stub for G3 / G4)
// ---------------------------------------------------------------------------
//
// This module is deliberately transport-only. It owns:
//   - The chunking policy (sentence boundaries, 512 token target, 64 overlap).
//   - The `qdrant_embedded_at` bookkeeping column so future workers and ad-hoc
//     rebuild commands share the same `is this document stale?` predicate.
//   - The Bolt emission surface (`document.embedded`) once a document lands in
//     Qdrant.
//
// What is NOT here on purpose:
//   - Any HTTP call to Qdrant. That lives in `apps/worker/src/jobs/brief-embed.job.ts`
//     where Qdrant credentials and retry/backoff live. Shipping the network
//     client in the API container would pull the worker deps into every brief
//     request path for no reason.
//   - Embedding model selection. The worker chooses based on
//     `BRIEF_EMBEDDING_PROVIDER` and hands raw chunks down to whatever SDK it
//     uses. Keeping the chooser out of the API avoids config drift between the
//     two containers.
// ---------------------------------------------------------------------------

export interface DocumentChunk {
  /** 0-indexed position within the source document. */
  index: number;
  /** Raw chunk text; already trimmed, never empty. */
  text: string;
  /** Character offset of the first character in the original plain text. */
  startOffset: number;
  /** Character offset of the character after the last chunk character. */
  endOffset: number;
}

/**
 * Splits plain-text document content into overlapping chunks sized for a
 * typical 512-token embedding context. The chunker walks sentence boundaries
 * (period, question mark, exclamation point, newline) so chunks do not slice
 * mid-sentence; if a single sentence is longer than `chunkSize`, it is emitted
 * on its own.
 *
 * This is a deterministic, dependency-free helper so unit tests and the
 * worker job share the same output.
 */
export function chunkDocument(
  plainText: string,
  chunkSize = 512,
  overlap = 64,
): DocumentChunk[] {
  if (!plainText) return [];
  if (chunkSize <= 0) throw new Error('chunkSize must be positive');
  if (overlap < 0 || overlap >= chunkSize) {
    throw new Error('overlap must be in [0, chunkSize)');
  }

  const sentenceBreaks = /(?<=[.!?])\s+|\n+/g;
  const rawSegments = plainText.split(sentenceBreaks).map((s) => s.trim()).filter(Boolean);

  const chunks: DocumentChunk[] = [];
  let buf = '';
  let bufStartOffset = 0;
  let cursor = 0;

  for (const segment of rawSegments) {
    const segmentStart = plainText.indexOf(segment, cursor);
    if (segmentStart >= 0) cursor = segmentStart + segment.length;

    const candidate = buf ? `${buf} ${segment}` : segment;
    if (candidate.length <= chunkSize) {
      if (!buf) bufStartOffset = segmentStart >= 0 ? segmentStart : 0;
      buf = candidate;
      continue;
    }

    if (buf) {
      chunks.push({
        index: chunks.length,
        text: buf,
        startOffset: bufStartOffset,
        endOffset: bufStartOffset + buf.length,
      });
      const tail = overlap > 0 ? buf.slice(-overlap) : '';
      buf = tail ? `${tail} ${segment}` : segment;
      bufStartOffset = segmentStart >= 0 ? segmentStart - tail.length - (tail ? 1 : 0) : 0;
    } else {
      // Single sentence longer than chunkSize; hard-split it.
      const start = segmentStart >= 0 ? segmentStart : 0;
      for (let i = 0; i < segment.length; i += chunkSize) {
        chunks.push({
          index: chunks.length,
          text: segment.slice(i, i + chunkSize),
          startOffset: start + i,
          endOffset: start + Math.min(i + chunkSize, segment.length),
        });
      }
      buf = '';
      bufStartOffset = 0;
    }
  }

  if (buf) {
    chunks.push({
      index: chunks.length,
      text: buf,
      startOffset: bufStartOffset,
      endOffset: bufStartOffset + buf.length,
    });
  }

  return chunks;
}

/**
 * Returns the set of document ids in {orgId} whose embedding index is stale:
 *   - `qdrant_embedded_at IS NULL`, OR
 *   - `qdrant_embedded_at < updated_at`
 *
 * Called by the future brief:embed worker job and by ad-hoc rebuild commands.
 * Limited to `limit` rows to keep each worker tick bounded.
 */
export async function listStaleEmbeddingDocuments(
  orgId: string | null,
  limit = 100,
): Promise<
  Array<{
    id: string;
    org_id: string;
    plain_text: string | null;
    updated_at: Date;
    qdrant_embedded_at: Date | null;
  }>
> {
  const staleCondition = or(
    isNull(briefDocuments.qdrant_embedded_at),
    lt(briefDocuments.qdrant_embedded_at, briefDocuments.updated_at),
  )!;

  const conditions = orgId
    ? and(eq(briefDocuments.org_id, orgId), staleCondition)
    : staleCondition;

  const rows = await db
    .select({
      id: briefDocuments.id,
      org_id: briefDocuments.org_id,
      plain_text: briefDocuments.plain_text,
      updated_at: briefDocuments.updated_at,
      qdrant_embedded_at: briefDocuments.qdrant_embedded_at,
    })
    .from(briefDocuments)
    .where(conditions)
    .orderBy(sql`${briefDocuments.updated_at} ASC`)
    .limit(limit);

  return rows;
}

/**
 * Marks a document as embedded. Called by the worker job after a successful
 * Qdrant upsert. Emits a `document.embedded` Bolt event (bare name, source
 * `'brief'`, canonical 6+1 signature) so downstream rules can react to
 * newly-indexed documents.
 */
export async function markDocumentEmbedded(
  docId: string,
  orgId: string,
  meta: { chunkCount: number; vectorDim?: number; model?: string } = { chunkCount: 0 },
): Promise<void> {
  const now = new Date();
  const [row] = await db
    .update(briefDocuments)
    .set({ qdrant_embedded_at: now })
    .where(and(eq(briefDocuments.id, docId), eq(briefDocuments.org_id, orgId)))
    .returning({ id: briefDocuments.id });

  if (!row) return;

  publishBoltEvent(
    'document.embedded',
    'brief',
    {
      document_id: docId,
      chunk_count: meta.chunkCount,
      vector_dim: meta.vectorDim ?? null,
      embedding_model: meta.model ?? null,
      embedded_at: now.toISOString(),
    },
    orgId,
    undefined,
    'system',
  ).catch(() => {});
}

/**
 * Clears the embedding watermark so the next worker tick will rebuild the
 * index for this document. Intentionally does not hit Qdrant; the worker is
 * responsible for purging stale vectors on upsert.
 */
export async function invalidateDocumentEmbedding(
  docId: string,
  orgId: string,
): Promise<void> {
  await db
    .update(briefDocuments)
    .set({ qdrant_embedded_at: null })
    .where(and(eq(briefDocuments.id, docId), eq(briefDocuments.org_id, orgId)));
}
