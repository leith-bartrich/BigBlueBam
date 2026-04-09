/**
 * Escape LIKE/ILIKE metacharacters so user input is treated as literal text.
 */
export function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

/**
 * Standard error factory for consistent API error responses.
 */
export class BlastError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'BlastError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function notFound(message: string): BlastError {
  return new BlastError(404, 'NOT_FOUND', message);
}

export function badRequest(message: string): BlastError {
  return new BlastError(400, 'BAD_REQUEST', message);
}

export function conflict(message: string): BlastError {
  return new BlastError(409, 'CONFLICT', message);
}

export function forbidden(message: string): BlastError {
  return new BlastError(403, 'FORBIDDEN', message);
}
