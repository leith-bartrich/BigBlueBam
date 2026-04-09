/**
 * Escape special characters in a string before interpolating into an SQL
 * LIKE / ILIKE pattern.  Without this, user-supplied `%` and `_` characters
 * act as wildcards, allowing callers to craft patterns that match more rows
 * than intended (BAM-022).
 *
 * The backslash itself is also escaped so the default `\` escape character
 * in PostgreSQL LIKE/ILIKE works correctly.
 */
export function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}
