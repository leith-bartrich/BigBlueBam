/**
 * Beacon vector sync job — syncs beacon content to Qdrant vector index.
 *
 * Accepts { beacon_id, action: 'upsert' | 'delete' }
 * On upsert: fetch beacon from DB, chunk, embed, upsert to Qdrant
 * On delete: remove all Qdrant points for the beacon
 * Updates beacon_entries.vector_sync_status on success/failure
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BeaconVectorSyncJobData {
  beacon_id: string;
  action: 'upsert' | 'delete';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DENSE_DIMENSION = 1024;
const COLLECTION_NAME = 'beacon_chunks';

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processBeaconVectorSyncJob(
  job: Job<BeaconVectorSyncJobData>,
  logger: Logger,
): Promise<void> {
  const { beacon_id, action } = job.data;

  logger.info({ jobId: job.id, beacon_id, action }, 'Processing beacon vector sync job');

  const db = getDb();

  try {
    // Lazy-import Qdrant client
    const { QdrantClient } = await import('@qdrant/js-client-rest');
    const client = new QdrantClient({
      url: process.env.QDRANT_URL ?? 'http://qdrant:6333',
      ...(process.env.QDRANT_API_KEY ? { apiKey: process.env.QDRANT_API_KEY } : {}),
    });

    if (action === 'delete') {
      // Mark as pending
      await db.execute(sql`
        UPDATE beacon_entries SET vector_sync_status = 'Pending'
        WHERE id = ${beacon_id}
      `);

      // Delete all Qdrant points for this beacon
      await client.delete(COLLECTION_NAME, {
        wait: true,
        filter: {
          must: [{ key: 'beacon_id', match: { value: beacon_id } }],
        },
      });

      // Mark synced
      await db.execute(sql`
        UPDATE beacon_entries SET vector_sync_status = 'Synced'
        WHERE id = ${beacon_id}
      `);

      logger.info({ beacon_id }, 'Beacon chunks deleted from Qdrant');
      return;
    }

    // --- Upsert flow ---

    // 1. Fetch beacon from DB
    const beaconRows = await db.execute(sql`
      SELECT id, slug, title, summary, body_markdown, version, status,
             visibility, created_by, owned_by, project_id, organization_id,
             expires_at
      FROM beacon_entries
      WHERE id = ${beacon_id}
      LIMIT 1
    `);

    const beacon = beaconRows[0] as any;
    if (!beacon) {
      logger.warn({ beacon_id }, 'Beacon not found, skipping vector sync');
      return;
    }

    // 2. Fetch tags
    const tagRows = await db.execute(sql`
      SELECT tag FROM beacon_tags WHERE beacon_id = ${beacon_id}
    `);
    const tagStrings = (tagRows as any[]).map((r: any) => r.tag as string);

    // 3. Fetch links with target titles
    const linkRows = await db.execute(sql`
      SELECT bl.source_id, bl.target_id, bl.link_type, be.title AS target_title
      FROM beacon_links bl
      JOIN beacon_entries be ON be.id = CASE
        WHEN bl.source_id = ${beacon_id} THEN bl.target_id
        ELSE bl.source_id
      END
      WHERE bl.source_id = ${beacon_id} OR bl.target_id = ${beacon_id}
    `);

    const linkedBeacons = (linkRows as any[]).map((r: any) => ({
      id: r.source_id === beacon_id ? r.target_id : r.source_id,
      title: r.target_title as string,
      link_type: r.link_type as string,
    }));
    const linkedIds = linkedBeacons.map((l) => l.id);

    // 4. Chunk the beacon content
    const chunks = chunkBeacon(beacon, tagStrings, linkedBeacons);

    // 5. Embed (stub: zero vectors)
    const denseVectors = chunks.map(() => new Array(DENSE_DIMENSION).fill(0) as number[]);
    const sparseVectors = chunks.map(() => ({ indices: [] as number[], values: [] as number[] }));

    // 6. Build and upsert points
    const points = chunks.map((chunk, idx) => ({
      id: `${beacon_id}__${idx}`,
      vector: {
        dense: denseVectors[idx]!,
        idf: sparseVectors[idx]!,
      },
      payload: {
        beacon_id: beacon.id,
        organization_id: beacon.organization_id,
        project_id: beacon.project_id,
        status: beacon.status,
        tags: tagStrings,
        visibility: beacon.visibility,
        chunk_index: idx,
        chunk_type: chunk.chunk_type,
        title: beacon.title,
        owned_by: beacon.owned_by,
        version: beacon.version,
        expires_at: beacon.expires_at?.toISOString?.() ?? beacon.expires_at ?? null,
        linked_beacon_ids: linkedIds,
      },
    }));

    await client.upsert(COLLECTION_NAME, {
      wait: true,
      points,
    });

    // 7. Update sync status
    await db.execute(sql`
      UPDATE beacon_entries SET vector_sync_status = 'Synced'
      WHERE id = ${beacon_id}
    `);

    logger.info({ beacon_id, chunkCount: chunks.length }, 'Beacon vectors synced to Qdrant');
  } catch (err) {
    // Mark as error
    try {
      await db.execute(sql`
        UPDATE beacon_entries SET vector_sync_status = 'Error'
        WHERE id = ${beacon_id}
      `);
    } catch {
      // Best effort
    }
    throw err; // Re-throw so BullMQ records the failure and can retry
  }
}

// ---------------------------------------------------------------------------
// Inline chunker (minimal copy to avoid cross-package deps)
// ---------------------------------------------------------------------------

interface Chunk {
  chunk_type: 'title_summary' | 'body_section' | 'tags_metadata';
  text: string;
  section_title?: string;
  char_offset: number;
}

function chunkBeacon(
  beacon: { title: string; summary: string | null; body_markdown: string },
  tags: string[],
  linkedBeacons: { title: string; link_type: string }[],
): Chunk[] {
  const chunks: Chunk[] = [];

  // title_summary
  const titleSummary = beacon.summary
    ? `${beacon.title} — ${beacon.summary}`
    : beacon.title;
  chunks.push({ chunk_type: 'title_summary', text: titleSummary, char_offset: 0 });

  // body_section — split at ## headings
  if (beacon.body_markdown?.trim()) {
    const lines = beacon.body_markdown.split('\n');
    let currentText = '';
    let charIndex = 0;
    let sectionStart = 0;

    for (const line of lines) {
      if (/^## /m.test(line) && currentText.trim()) {
        chunks.push({
          chunk_type: 'body_section',
          text: currentText.trim(),
          char_offset: sectionStart,
        });
        currentText = '';
        sectionStart = charIndex;
      }
      currentText += line + '\n';
      charIndex += line.length + 1;
    }
    if (currentText.trim()) {
      chunks.push({
        chunk_type: 'body_section',
        text: currentText.trim(),
        char_offset: sectionStart,
      });
    }
  }

  // tags_metadata
  const parts: string[] = [];
  if (tags.length > 0) parts.push(`Topics: ${tags.join(', ')}.`);
  if (linkedBeacons.length > 0) {
    parts.push(
      `Related: ${linkedBeacons.map((l) => `${l.title} (${l.link_type})`).join(', ')}.`,
    );
  }
  if (parts.length > 0) {
    chunks.push({ chunk_type: 'tags_metadata', text: parts.join(' '), char_offset: -1 });
  }

  return chunks;
}
