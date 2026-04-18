/**
 * Canonical mention-syntax patterns (AGENTIC_TODO §3, Wave 3).
 *
 * Single source of truth for inline entity references across the product:
 *
 *   - Banter composer autocomplete
 *   - Brief document mentions
 *   - Task / ticket comment parsing
 *   - MCP `resolve_references` Phase 1 pinned-mention extraction
 *
 * Every client that needs to extract "the user meant this specific entity"
 * from free text MUST pull from this module rather than reinventing the
 * regexes. Diverging shapes lead to authors typing `[[deal:Acme]]` in
 * Brief and having Banter's composer not recognise it, which breaks the
 * promise that mentions are portable across surfaces.
 *
 * ## Syntax summary
 *
 * | Pattern              | Example                      | Entity type          |
 * | -------------------- | ---------------------------- | -------------------- |
 * | `[[ABC-42]]`         | `[[FRND-42]]`                | task (human_id)      |
 * | `[[deal:NAME]]`      | `[[deal:Acme Rocket]]`       | bond deal            |
 * | `[[contact:X]]`      | `[[contact:jane@acme.com]]`  | bond contact         |
 * | `[[company:NAME]]`   | `[[company:Acme Inc]]`       | bond company         |
 * | `[[doc:slug]]`       | `[[doc:project-kickoff]]`    | brief document       |
 * | `[[ticket:N]]`       | `[[ticket:1234]]`            | helpdesk ticket      |
 * | `#NNN`               | `#1234`                      | helpdesk ticket      |
 * | `#slug`              | `#marketing-ops`             | bam project          |
 * | `@handle`            | `@jane.doe`                  | user                 |
 *
 * ## `#NNN` vs `#slug` collision
 *
 * The bare `#` prefix is overloaded between helpdesk tickets and Bam
 * project slugs. The rule is:
 *
 *   - `#` followed by **digits only** (`#123`, `#4567`) = ticket number.
 *   - `#` followed by at least one letter (`#abc`, `#marketing-ops`,
 *     `#v2-launch`) = project slug.
 *
 * A hypothetical slug of `#123` is not expressible via this syntax, which
 * is fine: the project-slug generator reserves slugs that start with a
 * digit, so real slugs always begin with `[a-z]`.
 *
 * Consumers extracting pinned mentions MUST apply the regex groups in
 * this order (digits-only variant first) to keep the tie-breaking
 * deterministic.
 *
 * ## Regex notes
 *
 * - Every pattern uses the `g` flag so consumers can iterate with
 *   `String.prototype.matchAll`. When copying individual patterns elsewhere,
 *   be aware that the `lastIndex` state is shared across matchAll loops,
 *   so create a fresh `RegExp` if you need to scan the same text twice.
 * - Task `human_id` format is 2-8 uppercase letters, a hyphen, digits.
 *   The prefix range matches the Drizzle `task_id_prefix` column (varchar
 *   up to 8 characters).
 * - `ticket` accepts either the `[[ticket:N]]` long form or the bare
 *   `#NNN` short form in a single alternation so both extract into the
 *   same capture group pair `(g1 | g2)`.
 * - `user` handles are the email localpart character class
 *   `[a-zA-Z0-9_.-]`. This matches the GitHub-style `@first.last` and also
 *   matches the full email localpart when an author types `@jane@acme.com`;
 *   the resolver strips the trailing `@domain` before falling back to
 *   email search.
 * - `project` slugs are lowercase alphanumerics with hyphens, matching the
 *   shape that the Bam project service emits.
 */
export const MENTION_PATTERNS = {
  task: /\[\[([A-Z]{2,8}-\d+)\]\]/g,
  deal: /\[\[deal:([^\]]+)\]\]/g,
  contact: /\[\[contact:([^\]]+)\]\]/g,
  company: /\[\[company:([^\]]+)\]\]/g,
  document: /\[\[doc:([^\]]+)\]\]/g,
  ticket: /\[\[ticket:(\d+)\]\]|#(\d+)/g,
  user: /@([a-zA-Z0-9_.-]+)/g,
  project: /#([a-z][a-z0-9-]*)/g,
} as const;

export type MentionKind = keyof typeof MENTION_PATTERNS;

export interface PinnedMention {
  kind: MentionKind;
  value: string;
  fragment: string;
  index: number;
}

/**
 * Extract every pinned mention from `text`, in the order they appear.
 *
 * The iteration order inside a single kind is left-to-right (regex
 * `matchAll` default). Across kinds, pinned mentions are deduplicated by
 * the `[kind, value]` pair so the same token extracted by two patterns
 * (notably the `ticket`/`project` `#` overlap) is only returned once,
 * with the digits-only interpretation winning per the §3 coordination
 * rules.
 *
 * Fresh `RegExp` instances are created for each extraction so callers
 * may invoke this function concurrently without the shared `lastIndex`
 * state bleeding across calls.
 */
export function extractPinnedMentions(text: string): PinnedMention[] {
  const out: PinnedMention[] = [];
  const seen = new Set<string>();

  // Order matters for the `#NNN` vs `#slug` tiebreak: ticket first, then
  // project. Because `ticket` requires digits and `project` requires a
  // leading letter, the two alternatives are disjoint; the explicit
  // ordering is defensive.
  const kinds: MentionKind[] = [
    'task',
    'deal',
    'contact',
    'company',
    'document',
    'ticket',
    'project',
    'user',
  ];

  for (const kind of kinds) {
    // Clone the pattern so we don't mutate the shared `lastIndex` state
    // on the module-level regex.
    const source = MENTION_PATTERNS[kind];
    const pattern = new RegExp(source.source, source.flags);
    for (const match of text.matchAll(pattern)) {
      // `ticket` has two capture groups (one for the long form, one for
      // the short form); pick whichever matched.
      const value =
        kind === 'ticket' ? (match[1] ?? match[2] ?? '') : (match[1] ?? '');
      if (!value) continue;
      const dedupeKey = `${kind}:${value.toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push({
        kind,
        value,
        fragment: match[0],
        index: match.index ?? 0,
      });
    }
  }

  // Return in source order so downstream consumers can strip matched
  // spans left-to-right without re-sorting.
  out.sort((a, b) => a.index - b.index);
  return out;
}

/**
 * Remove every span matched by `extractPinnedMentions` from `text`.
 *
 * Used by `resolve_references` Phase 2 to get the "remainder" text that
 * feeds into natural-language n-gram search. Replaces each matched span
 * with a single space to avoid accidentally welding the surrounding
 * words together ("Check [[ABC-42]]now" vs "Check  now").
 */
export function stripPinnedMentions(text: string): string {
  const mentions = extractPinnedMentions(text);
  if (mentions.length === 0) return text;

  // Replace in reverse index order so earlier indices stay valid.
  const sorted = [...mentions].sort((a, b) => b.index - a.index);
  let out = text;
  for (const m of sorted) {
    const before = out.slice(0, m.index);
    const after = out.slice(m.index + m.fragment.length);
    out = `${before} ${after}`;
  }
  return out;
}
