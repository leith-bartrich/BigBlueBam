/**
 * Escape LIKE/ILIKE metacharacters so user input is treated as literal text.
 */
export function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

/**
 * Standard error factory for consistent API error responses.
 */
export class BookError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'BookError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function notFound(message: string): BookError {
  return new BookError(404, 'NOT_FOUND', message);
}

export function badRequest(message: string): BookError {
  return new BookError(400, 'BAD_REQUEST', message);
}

export function conflict(message: string): BookError {
  return new BookError(409, 'CONFLICT', message);
}

export function forbidden(message: string): BookError {
  return new BookError(403, 'FORBIDDEN', message);
}
