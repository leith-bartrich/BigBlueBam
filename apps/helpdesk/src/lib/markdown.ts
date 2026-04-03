/**
 * Simple markdown-to-HTML converter.
 * Handles: **bold**, *italic*, `inline code`, ```code blocks```,
 * [links](url), ![images](url), ## headings, - lists, newlines.
 * Also sanitizes output by stripping script tags and event handlers.
 */
export function markdownToHtml(md: string): string {
  if (!md) return '';

  let html = md;

  // Escape HTML entities first (prevents XSS)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (``` ... ```) — must come before inline transformations
  html = html.replace(/```([\s\S]*?)```/g, (_match, code: string) => {
    return `<pre class="rich-text-code-block"><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code class="rich-text-inline-code">$1</code>');

  // Images: ![alt](url)
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer"><img src="$2" alt="$1" class="rich-text-image" /></a>',
  );

  // Links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="rich-text-link">$1</a>',
  );

  // Bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic: *text* (but not inside words with **)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Process line-by-line for headings and lists
  const lines = html.split('\n');
  const processed: string[] = [];
  let inList = false;

  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      if (inList) {
        processed.push('</ul>');
        inList = false;
      }
      const level = line.match(/^(#+)/)?.[1].length ?? 2;
      const text = line.replace(/^#+\s*/, '');
      processed.push(`<h${level} class="rich-text-heading">${text}</h${level}>`);
      continue;
    }

    if (/^\s*[-*]\s/.test(line)) {
      if (!inList) {
        processed.push('<ul class="rich-text-list">');
        inList = true;
      }
      const text = line.replace(/^\s*[-*]\s/, '');
      processed.push(`<li>${text}</li>`);
      continue;
    }

    if (inList) {
      processed.push('</ul>');
      inList = false;
    }

    if (line.trim() === '') {
      processed.push('<br />');
    } else {
      processed.push(line);
    }
  }

  if (inList) {
    processed.push('</ul>');
  }

  html = processed.join('\n');

  html = html.replace(/(?<!<\/(?:pre|ul|li|h[1-6]|br\s?\/)>)\n(?!<(?:pre|ul|li|h[1-6]|br))/g, '<br />');

  return html;
}

export function sanitizeHtml(html: string): string {
  let clean = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  clean = clean.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  clean = clean.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
  return clean;
}
