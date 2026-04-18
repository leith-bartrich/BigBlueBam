import { describe, it, expect, vi } from 'vitest';

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
    LOG_LEVEL: 'silent',
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_WINDOW_MS: 60000,
    UPLOAD_MAX_FILE_SIZE: 10485760,
    UPLOAD_ALLOWED_TYPES: 'image/*',
    COOKIE_SECURE: false,
  },
}));

vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn() },
  connection: { end: vi.fn() },
}));

import { __test__ } from '../src/services/activity-unified.service.js';

describe('activity-unified.service internals', () => {
  describe('clampLimit', () => {
    it('defaults to 50 when undefined', () => {
      expect(__test__.clampLimit(undefined)).toBe(50);
    });

    it('caps to 200 maximum', () => {
      expect(__test__.clampLimit(500)).toBe(200);
      expect(__test__.clampLimit(200)).toBe(200);
    });

    it('floors non-integer positives', () => {
      expect(__test__.clampLimit(17.8)).toBe(17);
    });

    it('defaults to 50 for non-finite / non-positive values', () => {
      expect(__test__.clampLimit(0)).toBe(50);
      expect(__test__.clampLimit(-5)).toBe(50);
      expect(__test__.clampLimit(Number.NaN)).toBe(50);
      expect(__test__.clampLimit(Number.POSITIVE_INFINITY)).toBe(50);
    });
  });

  describe('cursor round-trip', () => {
    const UUID = 'aaaaaaaa-1111-2222-3333-444444444444';

    it('parses a well-formed cursor', () => {
      const cursor = `2026-04-18T10:00:00.000Z|${UUID}`;
      const parsed = __test__.parseCursor(cursor);
      expect(parsed).not.toBeNull();
      expect(parsed!.id).toBe(UUID);
      expect(parsed!.created_at.toISOString()).toBe('2026-04-18T10:00:00.000Z');
    });

    it('rejects cursors without the pipe separator', () => {
      expect(__test__.parseCursor('just-a-string')).toBeNull();
    });

    it('rejects cursors with an unparseable timestamp', () => {
      expect(__test__.parseCursor(`not-a-date|${UUID}`)).toBeNull();
    });

    it('rejects cursors with empty id', () => {
      expect(__test__.parseCursor('2026-04-18T10:00:00.000Z|')).toBeNull();
    });

    it('round-trips a row into a stable cursor string', () => {
      const row = {
        id: UUID,
        source_app: 'bam' as const,
        entity_type: 'bam.task',
        entity_id: UUID,
        project_id: null,
        organization_id: null,
        actor_id: null,
        actor_type: 'human',
        action: 'task.create',
        details: null,
        created_at: '2026-04-18T10:00:00.000Z',
      };
      const cursor = __test__.makeCursor(row);
      expect(cursor).toBe(`2026-04-18T10:00:00.000Z|${UUID}`);
      const parsed = __test__.parseCursor(cursor);
      expect(parsed).not.toBeNull();
      expect(parsed!.id).toBe(UUID);
    });
  });
});
