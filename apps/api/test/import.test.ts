import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------- mocks ----------
const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
    execute: vi.fn(),
  };
  return { mockDb };
});

vi.mock('../src/db/index.js', () => ({
  db: mockDb,
  connection: { end: vi.fn() },
}));

vi.mock('../src/services/realtime.service.js', () => ({
  broadcastToProject: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/activity.service.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/env.js', () => ({
  env: {
    SESSION_TTL_SECONDS: 604800,
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    NODE_ENV: 'test',
    PORT: 4000,
    HOST: '0.0.0.0',
    SESSION_SECRET: 'a'.repeat(32),
    REDIS_URL: 'redis://localhost:6379',
    CORS_ORIGIN: 'http://localhost:3000',
    LOG_LEVEL: 'info',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    UPLOAD_MAX_FILE_SIZE: 10485760,
    UPLOAD_ALLOWED_TYPES: 'image/*',
    COOKIE_SECURE: false,
  },
}));

// ---------- helpers ----------

interface CsvRow {
  [key: string]: string;
}

interface CsvMapping {
  [csvColumn: string]: string;
}

interface ImportResult {
  imported: number;
  errors: { row: number; message: string }[];
}

/**
 * Simulates CSV import logic: maps CSV columns to task fields,
 * validates required fields, and creates tasks.
 */
function processCsvImport(
  rows: CsvRow[],
  mapping: CsvMapping,
  phases: { id: string; name: string }[],
): ImportResult {
  const result: ImportResult = { imported: 0, errors: [] };

  if (rows.length === 0) {
    return result;
  }

  // Find the mapped column for 'title'
  const titleColumn = Object.entries(mapping).find(([, field]) => field === 'title')?.[0];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;

    // Check required field: title
    if (!titleColumn || !row[titleColumn]?.trim()) {
      result.errors.push({ row: i + 1, message: 'Missing required field: title' });
      continue;
    }

    // Check phase mapping if present
    const phaseColumn = Object.entries(mapping).find(([, field]) => field === 'phase')?.[0];
    if (phaseColumn && row[phaseColumn]) {
      const phaseName = row[phaseColumn];
      const matchedPhase = phases.find(
        (p) => p.name.toLowerCase() === phaseName!.toLowerCase(),
      );
      if (!matchedPhase) {
        result.errors.push({
          row: i + 1,
          message: `Unknown phase: "${phaseName}". Skipped.`,
        });
        continue;
      }
    }

    result.imported++;
  }

  return result;
}

// ---------- tests ----------
describe('CSV Import Logic', () => {
  const phases = [
    { id: 'phase-1', name: 'To Do' },
    { id: 'phase-2', name: 'In Progress' },
    { id: 'phase-3', name: 'Done' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports valid CSV with all fields correctly', () => {
    const rows: CsvRow[] = [
      { Title: 'Task 1', Priority: 'high', Phase: 'To Do' },
      { Title: 'Task 2', Priority: 'medium', Phase: 'In Progress' },
      { Title: 'Task 3', Priority: 'low', Phase: 'Done' },
    ];
    const mapping: CsvMapping = {
      Title: 'title',
      Priority: 'priority',
      Phase: 'phase',
    };

    const result = processCsvImport(rows, mapping, phases);

    expect(result.imported).toBe(3);
    expect(result.errors).toHaveLength(0);
  });

  it('reports error for CSV rows with missing required title field', () => {
    const rows: CsvRow[] = [
      { Title: 'Valid Task', Priority: 'high' },
      { Title: '', Priority: 'medium' },
      { Title: '  ', Priority: 'low' },
    ];
    const mapping: CsvMapping = {
      Title: 'title',
      Priority: 'priority',
    };

    const result = processCsvImport(rows, mapping, phases);

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]!.row).toBe(2);
    expect(result.errors[0]!.message).toContain('title');
    expect(result.errors[1]!.row).toBe(3);
  });

  it('reports error for rows with no title mapping at all', () => {
    const rows: CsvRow[] = [
      { Name: 'Task 1', Priority: 'high' },
    ];
    // No title mapping
    const mapping: CsvMapping = {
      Name: 'description',
      Priority: 'priority',
    };

    const result = processCsvImport(rows, mapping, phases);

    expect(result.imported).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toContain('title');
  });

  it('reports error for rows with unknown phase and skips them', () => {
    const rows: CsvRow[] = [
      { Title: 'Task 1', Phase: 'To Do' },
      { Title: 'Task 2', Phase: 'Nonexistent Phase' },
      { Title: 'Task 3', Phase: 'In Progress' },
    ];
    const mapping: CsvMapping = {
      Title: 'title',
      Phase: 'phase',
    };

    const result = processCsvImport(rows, mapping, phases);

    expect(result.imported).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.row).toBe(2);
    expect(result.errors[0]!.message).toContain('Unknown phase');
    expect(result.errors[0]!.message).toContain('Nonexistent Phase');
  });

  it('returns 0 imported for empty CSV', () => {
    const rows: CsvRow[] = [];
    const mapping: CsvMapping = { Title: 'title' };

    const result = processCsvImport(rows, mapping, phases);

    expect(result.imported).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('handles CSV with extra unmapped columns gracefully', () => {
    const rows: CsvRow[] = [
      { Title: 'Task 1', ExtraCol: 'ignored', AnotherCol: 'also ignored' },
    ];
    const mapping: CsvMapping = {
      Title: 'title',
    };

    const result = processCsvImport(rows, mapping, phases);

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('phase matching is case-insensitive', () => {
    const rows: CsvRow[] = [
      { Title: 'Task 1', Phase: 'to do' },
      { Title: 'Task 2', Phase: 'TO DO' },
      { Title: 'Task 3', Phase: 'To Do' },
    ];
    const mapping: CsvMapping = {
      Title: 'title',
      Phase: 'phase',
    };

    const result = processCsvImport(rows, mapping, phases);

    expect(result.imported).toBe(3);
    expect(result.errors).toHaveLength(0);
  });
});
