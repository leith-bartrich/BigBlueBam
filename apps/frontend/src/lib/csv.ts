/**
 * Minimal RFC 4180 CSV exporter. No dependencies.
 *
 * - Fields containing comma, quote, or newline are quoted.
 * - Embedded quotes are escaped by doubling.
 * - Rows joined with CRLF.
 * - `null` / `undefined` serialized as empty string.
 * - `Date` serialized to ISO string.
 * - Other non-string values are coerced via String().
 */

export interface CsvColumn<T> {
  /** Header label written to row 1. */
  header: string;
  /** Accessor returning the raw cell value for a given row. */
  value: (row: T) => unknown;
}

function serializeCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function escapeField(raw: string): string {
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/** Serialize rows to RFC 4180 CSV text (no BOM). */
export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines: string[] = [];
  lines.push(columns.map((c) => escapeField(c.header)).join(','));
  for (const row of rows) {
    lines.push(
      columns
        .map((c) => escapeField(serializeCell(c.value(row))))
        .join(','),
    );
  }
  return lines.join('\r\n');
}

/**
 * Trigger a browser download of a CSV generated from `rows` + `columns`.
 * Uses a Blob URL that is revoked after the synthetic click fires.
 */
export function exportCsv<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): void {
  const csv = rowsToCsv(rows, columns);
  // Prepend a UTF-8 BOM so Excel auto-detects encoding for non-ASCII content.
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Slight delay before revoke so some browsers can start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Format today's date as YYYY-MM-DD in local time, for filenames. */
export function todayStamp(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
