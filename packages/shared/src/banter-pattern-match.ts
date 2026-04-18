/**
 * Shared banter pattern-match DSL and evaluator (AGENTIC_TODO §1, Wave 5).
 *
 * A subscription's pattern_spec is stored as JSONB on
 * banter_agent_subscriptions.pattern_spec. Four kinds are supported:
 *
 *   - 'interrogative'  { kind: 'interrogative' }
 *       Matches when the message looks like a question per
 *       isInterrogative() (wh-word start or trailing "?").
 *
 *   - 'keyword'        { kind: 'keyword', mode: 'any'|'all',
 *                        terms: string[], case_sensitive?: boolean }
 *       Matches when the message contains any/all of the listed terms.
 *       `mode` defaults to 'any'. Default case-insensitive.
 *
 *   - 'regex'          { kind: 'regex', pattern: string, flags?: string }
 *       Matches when new RegExp(pattern, flags).test(content) is true.
 *       Writes of this kind are ADMIN-ONLY on the banter-api side to
 *       mitigate ReDoS risk - the evaluator here does no sanity
 *       checking and trusts the spec.
 *
 *   - 'mention'        { kind: 'mention', user_id: string }
 *       Matches when the message mentions the named user (plain "@name"
 *       substring match against the message plaintext). This is a
 *       deliberately loose match; the canonical mention-notification
 *       path in banter-api already resolves display names to user ids,
 *       so the worker only needs to confirm presence.
 *
 * The evaluator returns a MatchOutcome with a `matched_text` field so
 * downstream listeners know which slice of the content tripped the
 * subscription. For interrogative/keyword/mention the returned text is
 * the entire trimmed content; for regex it is the match's .[0].
 */

import { isInterrogative } from './constants/interrogative-patterns.js';

export type BanterPatternKind = 'interrogative' | 'keyword' | 'regex' | 'mention';

export interface BanterPatternInterrogative {
  kind: 'interrogative';
}

export interface BanterPatternKeyword {
  kind: 'keyword';
  mode?: 'any' | 'all';
  terms: string[];
  case_sensitive?: boolean;
}

export interface BanterPatternRegex {
  kind: 'regex';
  pattern: string;
  flags?: string;
}

export interface BanterPatternMention {
  kind: 'mention';
  /**
   * The user id to match against. The message producer does not have
   * direct access to user ids in free text - the matcher resolves by
   * looking for the name string in the message. The caller must supply
   * the display_name to match; we pass user_id through so the worker
   * can emit it in banter.message.matched's match.* payload.
   */
  user_id: string;
  display_name: string;
}

export type BanterPatternSpec =
  | BanterPatternInterrogative
  | BanterPatternKeyword
  | BanterPatternRegex
  | BanterPatternMention;

export interface MatchOutcome {
  matched: boolean;
  /** The slice of the content that tripped the match; null if !matched. */
  matched_text: string | null;
}

/**
 * Evaluate a pattern against a message's plaintext content. Returns
 * `{ matched: false, matched_text: null }` when the pattern does not
 * match. Never throws - a malformed regex (e.g. bad flags) returns
 * non-match rather than propagating. Callers should still validate
 * specs at write time.
 */
export function evaluateBanterPattern(
  spec: BanterPatternSpec,
  content: string,
): MatchOutcome {
  if (typeof content !== 'string' || content.length === 0) {
    return { matched: false, matched_text: null };
  }

  switch (spec.kind) {
    case 'interrogative': {
      if (isInterrogative(content)) {
        return { matched: true, matched_text: content.trim() };
      }
      return { matched: false, matched_text: null };
    }

    case 'keyword': {
      const mode = spec.mode ?? 'any';
      const terms = Array.isArray(spec.terms) ? spec.terms : [];
      if (terms.length === 0) return { matched: false, matched_text: null };
      const caseSensitive = spec.case_sensitive === true;
      const haystack = caseSensitive ? content : content.toLowerCase();
      const needles = caseSensitive
        ? terms
        : terms.map((t) => t.toLowerCase());
      const present = (needle: string) => haystack.includes(needle);
      const ok = mode === 'all' ? needles.every(present) : needles.some(present);
      if (ok) return { matched: true, matched_text: content.trim() };
      return { matched: false, matched_text: null };
    }

    case 'regex': {
      try {
        const re = new RegExp(spec.pattern, spec.flags ?? '');
        const m = re.exec(content);
        if (m) return { matched: true, matched_text: m[0] };
      } catch {
        // Malformed pattern - treat as non-match. Writes are gated on
        // the banter-api side; a bad spec here means schema drift or a
        // post-migration row we cannot interpret.
      }
      return { matched: false, matched_text: null };
    }

    case 'mention': {
      if (typeof spec.display_name !== 'string' || spec.display_name.length === 0) {
        return { matched: false, matched_text: null };
      }
      const haystack = content.toLowerCase();
      const needle = `@${spec.display_name.toLowerCase()}`;
      if (haystack.includes(needle)) {
        return { matched: true, matched_text: content.trim() };
      }
      return { matched: false, matched_text: null };
    }

    default: {
      // Exhaustiveness guard - an unknown kind reaching this branch
      // means schema drift. Fail closed.
      return { matched: false, matched_text: null };
    }
  }
}

/**
 * Stable-ish hash of a pattern spec for client-side dedup checks before
 * the server writes the row. The server stores md5(pattern_spec::text)
 * in the unique index; callers sending the same canonical spec twice
 * should expect a 409. This helper is a courtesy, not authoritative.
 */
export function canonicalizeBanterPatternSpec(spec: BanterPatternSpec): string {
  // JSON.stringify with sorted keys.
  const keys = Object.keys(spec).sort();
  const obj: Record<string, unknown> = {};
  for (const k of keys) {
    obj[k] = (spec as unknown as Record<string, unknown>)[k];
  }
  return JSON.stringify(obj);
}
