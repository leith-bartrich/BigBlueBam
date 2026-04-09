/**
 * Escape LIKE/ILIKE metacharacters so user input is treated as literal text.
 */
export function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

/**
 * Standard error factory for consistent API error responses.
 */
export class BondError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'BondError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function notFound(message: string): BondError {
  return new BondError(404, 'NOT_FOUND', message);
}

export function badRequest(message: string): BondError {
  return new BondError(400, 'BAD_REQUEST', message);
}

export function conflict(message: string): BondError {
  return new BondError(409, 'CONFLICT', message);
}
