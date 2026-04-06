import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

/**
 * Phase 6: GitHub integration helpers.
 *
 * This module is intentionally framework-agnostic — it exports pure
 * functions that the routes and tests both consume. Keeping HMAC
 * verification and ref parsing out of the Fastify handler makes them
 * trivial to unit test without spinning up the server.
 */

/**
 * Matches Bam task human_ids such as "MAGE-38" or "bbam-1024". GitHub
 * commit messages and PR bodies commonly embed these inline, so we scan
 * for any 2–10 letter prefix followed by a dash and digits. The prefix
 * portion is case-insensitive at the regex level; the caller uppercases
 * the result before looking it up in `tasks.human_id`.
 *
 * Word-boundary anchors keep us from matching URL fragments like
 * "/pull/42-fix" where "ull-42" is not a real ticket.
 */
const TASK_REF_REGEX = /\b([A-Za-z]{2,10}-\d+)\b/g;

/**
 * Extracts all unique task references from a blob of text (commit
 * message, PR title, PR body). Returns uppercased human_ids so the
 * caller can match directly against the stored value, and deduplicates
 * so a PR body that mentions MAGE-38 three times only yields one row.
 */
export function parseTaskRefs(text: string | null | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  for (const match of text.matchAll(TASK_REF_REGEX)) {
    seen.add(match[1]!.toUpperCase());
  }
  return [...seen];
}

/**
 * Verifies GitHub's X-Hub-Signature-256 header.
 *
 * GitHub computes `sha256=<hex>` where the hex is an HMAC-SHA256 of the
 * raw request body keyed on the webhook secret that was configured when
 * the webhook was registered. We MUST compare against the raw body
 * bytes, not JSON-reserialized output, or whitespace differences will
 * break verification.
 *
 * Returns true on valid signature, false otherwise. Both the length
 * check and timingSafeEqual protect against timing attacks on the
 * comparison.
 */
export function verifyGithubSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const provided = signatureHeader.slice('sha256='.length);
  const bodyBuf = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const expected = createHmac('sha256', secret).update(bodyBuf).digest('hex');

  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Generates a fresh webhook secret: 32 random bytes rendered as 64 hex
 * chars. Long enough that brute-forcing the HMAC is impractical and
 * short enough to copy-paste into GitHub's webhook UI.
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Decides which phase (if any) a task should transition to given the
 * incoming PR event. Returns null when no transition should happen.
 *
 * Rules:
 *   - PR opened  → integration.transition_on_pr_open_phase_id   (if set)
 *   - PR merged  → integration.transition_on_pr_merged_phase_id (if set)
 *   - any other PR action → no transition
 *
 * A merged PR arrives as action='closed' + merged=true, hence the
 * explicit merged flag below.
 */
export function decidePrTransition(
  action: string | undefined,
  merged: boolean,
  config: {
    transition_on_pr_open_phase_id: string | null;
    transition_on_pr_merged_phase_id: string | null;
  },
): string | null {
  if (action === 'opened') return config.transition_on_pr_open_phase_id ?? null;
  if (action === 'closed' && merged) return config.transition_on_pr_merged_phase_id ?? null;
  return null;
}
