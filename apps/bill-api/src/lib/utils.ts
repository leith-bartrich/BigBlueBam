/**
 * Escape LIKE/ILIKE metacharacters so user input is treated as literal text.
 */
export function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&');
}

/**
 * Standard error factory for consistent API error responses.
 */
export class BillError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'BillError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function notFound(message: string): BillError {
  return new BillError(404, 'NOT_FOUND', message);
}

export function badRequest(message: string): BillError {
  return new BillError(400, 'BAD_REQUEST', message);
}

export function conflict(message: string): BillError {
  return new BillError(409, 'CONFLICT', message);
}

export function forbidden(message: string): BillError {
  return new BillError(403, 'FORBIDDEN', message);
}

/**
 * Format an invoice number from a prefix and a number.
 * Pattern: {prefix}-{number:05d} -> "INV-00001"
 */
export function formatInvoiceNumber(prefix: string, num: number): string {
  return `${prefix}-${String(num).padStart(5, '0')}`;
}

/**
 * Format cents to a display string (e.g. 15000 -> "$150.00").
 */
export function centsToDisplay(cents: number, currency = 'USD'): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(dollars);
}
