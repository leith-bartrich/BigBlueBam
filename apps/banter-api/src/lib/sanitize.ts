import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'b', 'i', 'em', 'strong', 'a', 'code', 'pre', 'br', 'p',
  'ul', 'ol', 'li', 'blockquote',
];

const ALLOWED_ATTR = ['href', 'class'];

export function sanitizeContent(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
