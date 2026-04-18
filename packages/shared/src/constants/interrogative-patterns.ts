/**
 * Shared interrogative lexicon (AGENTIC_TODO §1, Wave 5).
 *
 * Listeners across the suite need to agree on what counts as a "question",
 * a "request", or a "question-shaped message" so pattern subscriptions
 * produce consistent matches. All regex/keyword helpers live here so
 * banter-api, the worker pattern-match consumer, and any client-side
 * affordances pull from a single source of truth.
 *
 * None of these helpers touch the DB or the network. They are pure
 * string tests, safe to run inline on hot paths.
 */

/**
 * Standard English wh- interrogative words. Not exhaustive (we skip rare
 * variants like "whither"); intended as the baseline set a listener
 * subscribing to "questions" should match.
 */
export const WH_WORDS = [
  'who',
  'what',
  'when',
  'where',
  'why',
  'how',
  'which',
] as const;

/**
 * Regex that matches a string looking like a question. Two shapes:
 *   1. Ends with a "?" (optionally followed by whitespace).
 *   2. Begins with a wh-word or a yes/no interrogative auxiliary
 *      ("is", "are", "can", "could", "should", "would", "will", "do",
 *      "does", "did") followed by a word boundary.
 *
 * Case-insensitive. Run with .test() — do not .exec() and read groups;
 * the groups are incidental to the shape check.
 */
export const QUESTION_REGEX =
  /\?\s*$|^\s*(who|what|when|where|why|how|which|is|are|can|could|should|would|will|do|does|did)\b/i;

/**
 * Common "help me" / "please" verbs and phrases. Used for "request"
 * pattern matches that are NOT question-shaped (e.g. "please close the
 * ticket" has no "?" and does not start with a wh-word). Matched with
 * substring-contains, case-insensitively.
 */
export const REQUEST_VERBS = [
  'please',
  'can you',
  'could you',
  'would you',
  'help me',
  'i need',
] as const;

/**
 * Return true when the input looks like a natural-language question.
 * Returns false for empty / whitespace-only strings.
 */
export function isInterrogative(text: string): boolean {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  return QUESTION_REGEX.test(trimmed);
}

/**
 * Return true when the input contains any of the REQUEST_VERBS substrings.
 * Case-insensitive. Independent of isInterrogative: a message can be both
 * ("please can you help?") or neither.
 */
export function isRequest(text: string): boolean {
  if (typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  for (const verb of REQUEST_VERBS) {
    if (lower.includes(verb)) return true;
  }
  return false;
}
