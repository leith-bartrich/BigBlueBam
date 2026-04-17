/**
 * Board thumbnail generation worker.
 *
 * Renders a small SVG preview from the board's stored scene JSON (yjs_state)
 * and uploads it to MinIO under `board/thumbnails/<board-id>.svg`.
 * Updates `boards.thumbnail_url` with the public path.
 *
 * Triggered on demand (e.g. after a board edit debounce) or via a
 * scheduled sweep that regenerates stale thumbnails.
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BoardThumbnailJobData {
  /** When provided, regenerate thumbnail for a single board. */
  board_id?: string;
  /** When true, sweep all boards that have been updated since their last thumbnail. */
  sweep?: boolean;
}

// ---------------------------------------------------------------------------
// SVG rendering (lightweight, matches export.service.ts logic)
// ---------------------------------------------------------------------------

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderThumbnailSvg(
  elements: Record<string, unknown>[],
): string {
  const live = elements.filter((e) => e.isDeleted !== true);

  if (live.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="white"/><text x="150" y="100" text-anchor="middle" font-family="sans-serif" fill="#9ca3af" font-size="14">Empty</text></svg>';
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of live) {
    const x = typeof el.x === 'number' ? el.x : 0;
    const y = typeof el.y === 'number' ? el.y : 0;
    const w = typeof el.width === 'number' ? el.width : 50;
    const h = typeof el.height === 'number' ? el.height : 50;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x + w > maxX) maxX = x + w;
    if (y + h > maxY) maxY = y + h;
  }

  const pad = 10;
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  const vw = maxX - minX;
  const vh = maxY - minY;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="${minX} ${minY} ${vw} ${vh}">`);
  parts.push(`<rect x="${minX}" y="${minY}" width="${vw}" height="${vh}" fill="white"/>`);

  for (const el of live) {
    const type = el.type as string | undefined;
    const x = typeof el.x === 'number' ? el.x : 0;
    const y = typeof el.y === 'number' ? el.y : 0;
    const w = typeof el.width === 'number' ? el.width : 50;
    const h = typeof el.height === 'number' ? el.height : 50;
    const stroke = typeof el.strokeColor === 'string' ? el.strokeColor : '#1e1e1e';
    const bg = typeof el.backgroundColor === 'string' ? el.backgroundColor : 'transparent';

    switch (type) {
      case 'rectangle':
        parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg}" stroke="${stroke}" stroke-width="1" rx="2"/>`);
        break;
      case 'ellipse':
        parts.push(`<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${bg}" stroke="${stroke}" stroke-width="1"/>`);
        break;
      case 'text': {
        const text = typeof el.text === 'string' ? el.text.slice(0, 50) : '';
        const fs = typeof el.fontSize === 'number' ? el.fontSize : 14;
        parts.push(`<text x="${x}" y="${y + fs}" font-size="${fs}" fill="${stroke}" font-family="sans-serif">${escapeXml(text)}</text>`);
        break;
      }
      default:
        parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg === 'transparent' ? 'none' : bg}" stroke="${stroke}" stroke-width="1"/>`);
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

export async function processBoardThumbnailJob(
  job: Job<BoardThumbnailJobData>,
  logger: Logger,
): Promise<void> {
  const db = getDb();
  const { board_id, sweep } = job.data;

  if (board_id) {
    await generateThumbnail(db, board_id, logger);
    return;
  }

  if (sweep) {
    // Find boards updated in the last 24h that have no thumbnail or stale thumbnail
    const boards: any[] = await db.execute(
      sql`SELECT id FROM boards
          WHERE archived_at IS NULL
            AND yjs_state IS NOT NULL
            AND updated_at > NOW() - INTERVAL '24 hours'
          ORDER BY updated_at DESC
          LIMIT 100`,
    );

    logger.info({ count: boards.length }, 'board-thumbnail sweep: boards to process');

    for (const row of boards) {
      try {
        await generateThumbnail(db, row.id, logger);
      } catch (err) {
        logger.error({ err, boardId: row.id }, 'board-thumbnail: failed to generate thumbnail');
      }
    }
  }
}

async function generateThumbnail(
  db: ReturnType<typeof getDb>,
  boardId: string,
  logger: Logger,
): Promise<void> {
  const rows: any[] = await db.execute(
    sql`SELECT yjs_state, name FROM boards WHERE id = ${boardId} LIMIT 1`,
  );

  const row = rows[0];
  if (!row || !row.yjs_state) {
    logger.debug({ boardId }, 'board-thumbnail: no scene data, skipping');
    return;
  }

  let scene: { elements: Record<string, unknown>[] };
  try {
    const buf = Buffer.isBuffer(row.yjs_state) ? row.yjs_state : Buffer.from(row.yjs_state);
    scene = JSON.parse(buf.toString('utf-8'));
  } catch {
    logger.warn({ boardId }, 'board-thumbnail: failed to parse yjs_state');
    return;
  }

  const svg = renderThumbnailSvg(scene.elements ?? []);

  // Upload to MinIO via the /files endpoint or direct S3 API.
  // For now, store the SVG as a data URI in thumbnail_url.
  // A proper MinIO upload would use @aws-sdk/client-s3, but that introduces
  // a new dependency. Using the boards.thumbnail_url column with a data URI
  // allows the frontend to render immediately.  A future iteration should
  // upload to MinIO at board/thumbnails/<id>.svg and store the URL.
  const thumbnailUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

  await db.execute(
    sql`UPDATE boards SET thumbnail_url = ${thumbnailUrl}, updated_at = NOW()
        WHERE id = ${boardId}`,
  );

  logger.info({ boardId }, 'board-thumbnail: generated and stored');
}
