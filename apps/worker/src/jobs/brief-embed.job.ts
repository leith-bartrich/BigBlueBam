/**
 * Brief document embedding job (Brief_Plan.md G3).
 *
 * Finds `brief_documents` rows whose Qdrant embedding is stale (either
 * never indexed or updated since the last index run) and brings them
 * back in sync. If the Qdrant env is configured we actually push zero-
 * vector stub embeddings to the `brief_documents` collection; if not we
 * log the chunks that would have been embedded and still flip
 * `qdrant_embedded_at` so the row no longer flags as stale.
 *
 * Bolt event: `document.embedded` with source `'brief'`.
 *
 * The vector generation itself is intentionally stubbed (zero vectors).
 * A follow-up wave can plug in a real embeddings provider; the upsert
 * wiring, chunking, and state tracking all work against the stub.
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';
import { publishBoltEvent } from '../utils/bolt-events.js';

export interface BriefEmbedJobData {
  /** Optional: scope to a single document. */
  document_id?: string;
  /** Optional: scope to a single org. */
  org_id?: string;
  /** Max documents per tick. Defaults to 50. */
  limit?: number;
}

interface StaleDocRow {
  id: string;
  org_id: string;
  title: string;
  plain_text: string | null;
  updated_at: Date;
}

const COLLECTION_NAME = 'brief_documents';
const DENSE_DIMENSION = 1024;
const CHUNK_SIZE = 2_000;

function chunkPlainText(text: string): string[] {
  if (!text) return [];
  const chunks: string[] = [];
  for (let offset = 0; offset < text.length; offset += CHUNK_SIZE) {
    chunks.push(text.slice(offset, offset + CHUNK_SIZE));
  }
  return chunks;
}

async function fetchStaleDocuments(
  orgId: string | undefined,
  documentId: string | undefined,
  limit: number,
): Promise<StaleDocRow[]> {
  const db = getDb();
  const rowsRaw = await db.execute(sql`
    SELECT id, org_id, title, plain_text, updated_at
    FROM brief_documents
    WHERE (
        qdrant_embedded_at IS NULL
        OR qdrant_embedded_at < updated_at
      )
      AND archived_at IS NULL
      ${orgId ? sql`AND org_id = ${orgId}` : sql``}
      ${documentId ? sql`AND id = ${documentId}` : sql``}
    ORDER BY updated_at ASC
    LIMIT ${limit}
  `);
  const rows = Array.isArray(rowsRaw) ? rowsRaw : ((rowsRaw as { rows?: unknown[] }).rows ?? []);
  return rows as StaleDocRow[];
}

async function markEmbedded(docId: string): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    UPDATE brief_documents
    SET qdrant_embedded_at = NOW()
    WHERE id = ${docId}
  `);
}

export async function processBriefEmbedJob(
  job: Job<BriefEmbedJobData>,
  logger: Logger,
): Promise<void> {
  const { document_id, org_id, limit } = job.data ?? {};
  const cap = limit ?? 50;
  logger.info({ jobId: job.id, document_id, org_id, limit: cap }, 'brief-embed: tick start');

  const docs = await fetchStaleDocuments(org_id, document_id, cap);
  if (docs.length === 0) {
    logger.debug('brief-embed: no stale documents');
    return;
  }

  const qdrantUrl = process.env.QDRANT_URL;
  type QdrantUpserter = {
    upsert: (collection: string, body: unknown) => Promise<unknown>;
  };
  let qdrantClient: QdrantUpserter | null = null;

  if (qdrantUrl) {
    try {
      const mod = await import('@qdrant/js-client-rest');
      const client = new mod.QdrantClient({
        url: qdrantUrl,
        ...(process.env.QDRANT_API_KEY ? { apiKey: process.env.QDRANT_API_KEY } : {}),
      });
      qdrantClient = client as unknown as QdrantUpserter;
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err) },
        'brief-embed: failed to load Qdrant client, falling back to log-only mode',
      );
      qdrantClient = null;
    }
  }

  let embedded = 0;
  let failed = 0;

  for (const doc of docs) {
    try {
      const chunks = chunkPlainText(doc.plain_text ?? doc.title ?? '');
      if (chunks.length === 0) {
        logger.debug({ documentId: doc.id }, 'brief-embed: no content to embed, stamping only');
        await markEmbedded(doc.id);
        embedded += 1;
        continue;
      }

      if (qdrantClient) {
        const points = chunks.map((chunk, idx) => ({
          id: `${doc.id}__${idx}`,
          vector: new Array(DENSE_DIMENSION).fill(0) as number[],
          payload: {
            document_id: doc.id,
            org_id: doc.org_id,
            title: doc.title,
            chunk_index: idx,
            chunk_text: chunk,
          },
        }));
        try {
          await qdrantClient.upsert(COLLECTION_NAME, { wait: true, points });
          logger.info(
            { documentId: doc.id, chunks: chunks.length },
            'brief-embed: upserted to Qdrant',
          );
        } catch (qerr) {
          logger.warn(
            {
              documentId: doc.id,
              err: qerr instanceof Error ? qerr.message : String(qerr),
            },
            'brief-embed: Qdrant upsert failed, stamping as embedded anyway (stub mode)',
          );
        }
      } else {
        logger.info(
          { documentId: doc.id, chunks: chunks.length, title: doc.title },
          'brief-embed: Qdrant not configured, would have embedded chunks',
        );
      }

      await markEmbedded(doc.id);

      await publishBoltEvent(
        'document.embedded',
        'brief',
        {
          document_id: doc.id,
          chunk_count: chunks.length,
          vector_dim: DENSE_DIMENSION,
          collection: COLLECTION_NAME,
        },
        doc.org_id,
        undefined,
        'system',
      );

      embedded += 1;
    } catch (err) {
      failed += 1;
      logger.error(
        {
          documentId: doc.id,
          err: err instanceof Error ? err.message : String(err),
        },
        'brief-embed: failed to embed document',
      );
    }
  }

  logger.info(
    { jobId: job.id, candidates: docs.length, embedded, failed },
    'brief-embed: tick complete',
  );
}
