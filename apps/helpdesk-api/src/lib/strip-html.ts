/**
 * stripHtml — conservative HTML-to-plaintext helper.
 *
 * Removes tags, decodes the five XML entities plus numeric character
 * references, and collapses runs of whitespace. Intentionally dependency-free.
 * For stored-HTML sanitization (i.e. keeping safe markup intact) use a
 * dedicated sanitizer like DOMPurify or sanitize-html instead.
 */
export function stripHtml(input: string): string {
  if (!input) return '';

  // Drop <script> and <style> blocks entirely (including their contents),
  // otherwise their text would leak into the plaintext output.
  let out = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');

  // Convert common block-level tags to spaces so words don't run together.
  out = out.replace(/<\/?(p|div|br|li|tr|h[1-6]|blockquote)[^>]*>/gi, ' ');

  // Remove all remaining tags.
  out = out.replace(/<[^>]*>/g, '');

  // Decode the five named XML entities.
  out = out
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Decode numeric character references (&#65; and &#x41;).
  out = out.replace(/&#(\d+);/g, (_, n) => {
    const code = Number.parseInt(n, 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : '';
  });
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => {
    const code = Number.parseInt(n, 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : '';
  });

  // Collapse whitespace runs.
  out = out.replace(/\s+/g, ' ');

  return out;
}
