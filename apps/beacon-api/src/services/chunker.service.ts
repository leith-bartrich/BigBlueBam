/**
 * Chunker service — splits a Beacon entry into vector-indexable chunks.
 *
 * Per §2.2.4 of the Beacon Design Spec:
 * - title_summary: title + summary concatenated
 * - body_section: split body_markdown at ## headings or ~512 char boundary
 * - tags_metadata: synthetic chunk joining all tags + linked titles
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChunkType = 'title_summary' | 'body_section' | 'tags_metadata';

export interface Chunk {
  chunk_type: ChunkType;
  text: string;
  section_title?: string;
  char_offset: number;
}

export interface BeaconForChunking {
  title: string;
  summary?: string | null;
  body_markdown: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BODY_CHAR_LIMIT = 512;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Produce chunks from a Beacon entry for vector indexing.
 *
 * @param beacon  - The beacon entry (title, summary, body_markdown)
 * @param tags    - Array of tag strings associated with this beacon
 * @param linkedTitles - Array of { title, link_type } for linked beacons
 */
export function chunkBeacon(
  beacon: BeaconForChunking,
  tags: string[],
  linkedTitles: { title: string; link_type: string }[],
): Chunk[] {
  const chunks: Chunk[] = [];

  // --- Chunk 0: title_summary ---
  const titleSummary = beacon.summary
    ? `${beacon.title} — ${beacon.summary}`
    : beacon.title;

  chunks.push({
    chunk_type: 'title_summary',
    text: titleSummary,
    char_offset: 0,
  });

  // --- Chunk 1..N: body_section ---
  const bodySections = splitBody(beacon.body_markdown);
  for (const section of bodySections) {
    chunks.push({
      chunk_type: 'body_section',
      text: section.text,
      section_title: section.heading ?? undefined,
      char_offset: section.offset,
    });
  }

  // --- Final chunk: tags_metadata ---
  const tagsPart = tags.length > 0 ? `Topics: ${tags.join(', ')}.` : '';
  const linksPart =
    linkedTitles.length > 0
      ? `Related: ${linkedTitles.map((l) => `${l.title} (${l.link_type})`).join(', ')}.`
      : '';

  const metadataText = [tagsPart, linksPart].filter(Boolean).join(' ');
  if (metadataText) {
    chunks.push({
      chunk_type: 'tags_metadata',
      text: metadataText,
      char_offset: -1, // synthetic chunk, no real offset
    });
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface BodySection {
  heading: string | null;
  text: string;
  offset: number;
}

/**
 * Split markdown body at `## ` heading boundaries. If a section exceeds
 * BODY_CHAR_LIMIT, split it further at paragraph or character boundaries.
 */
export function splitBody(body: string): BodySection[] {
  if (!body || body.trim().length === 0) return [];

  // Split at ## headings (but not ### or deeper — we collapse those into parent)
  const headingRegex = /^## /m;
  const parts: BodySection[] = [];
  const lines = body.split('\n');
  let currentHeading: string | null = null;
  let currentText = '';
  let currentOffset = 0;
  let charIndex = 0;

  for (const line of lines) {
    if (headingRegex.test(line)) {
      // Flush accumulated text
      if (currentText.trim().length > 0) {
        parts.push({
          heading: currentHeading,
          text: currentText.trim(),
          offset: currentOffset,
        });
      }
      currentHeading = line.replace(/^## /, '').trim();
      currentText = line + '\n';
      currentOffset = charIndex;
    } else {
      currentText += line + '\n';
    }
    charIndex += line.length + 1; // +1 for \n
  }

  // Flush last section
  if (currentText.trim().length > 0) {
    parts.push({
      heading: currentHeading,
      text: currentText.trim(),
      offset: currentOffset,
    });
  }

  // Sub-split sections that exceed the char limit
  const result: BodySection[] = [];
  for (const section of parts) {
    if (section.text.length <= BODY_CHAR_LIMIT) {
      result.push(section);
    } else {
      const subParts = splitAtCharBoundary(section.text, BODY_CHAR_LIMIT);
      for (let i = 0; i < subParts.length; i++) {
        result.push({
          heading: i === 0 ? section.heading : section.heading ? `${section.heading} (cont.)` : null,
          text: subParts[i]!,
          offset: section.offset + sumLengths(subParts.slice(0, i)),
        });
      }
    }
  }

  return result;
}

/**
 * Split text at roughly `limit` character boundaries, preferring paragraph
 * breaks (double newline) or sentence ends.
 */
function splitAtCharBoundary(text: string, limit: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > limit) {
    // Try to find a paragraph break near the limit
    let splitIdx = remaining.lastIndexOf('\n\n', limit);
    if (splitIdx < limit * 0.3) {
      // Too far back — try sentence boundary
      splitIdx = remaining.lastIndexOf('. ', limit);
      if (splitIdx < limit * 0.3) {
        // Just split at the limit
        splitIdx = limit;
      } else {
        splitIdx += 2; // include '. '
      }
    } else {
      splitIdx += 2; // skip past \n\n
    }

    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

function sumLengths(parts: string[]): number {
  return parts.reduce((sum, p) => sum + p.length, 0);
}
