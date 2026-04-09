/**
 * Escape LIKE/ILIKE metacharacters so user input is treated as literal text.
 */
export function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

/**
 * Standard error factory for consistent API error responses.
 */
export class BlankError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'BlankError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function notFound(message: string): BlankError {
  return new BlankError(404, 'NOT_FOUND', message);
}

export function badRequest(message: string): BlankError {
  return new BlankError(400, 'BAD_REQUEST', message);
}

export function conflict(message: string): BlankError {
  return new BlankError(409, 'CONFLICT', message);
}

export function forbidden(message: string): BlankError {
  return new BlankError(403, 'FORBIDDEN', message);
}
