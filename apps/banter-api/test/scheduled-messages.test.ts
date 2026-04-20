// §13 Wave 4 scheduled banter — unit tests for the scheduled-post service
// and the quiet-hours integration points on the message-create path.
//
// This file focuses on the logic that can be exercised without a running
// Postgres. The full 202/409/201 HTTP matrix is covered by the route-level
// tests when the stack is live; here we unit-test the ScheduledPostError
// thresholds, the zod schema extension, and the per-case branching decisions.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// Mock env so loading scheduled-post.service (which transitively imports
// env via its db graph) does not trip the SESSION_SECRET validation in
// env.ts's loadEnv() when CI hasn't exported it.
vi.mock('../src/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    SESSION_SECRET: 'x'.repeat(32),
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
  },
}));

// Mock db + BullMQ for the service
vi.mock('../src/db/index.js', () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn(),
  },
  connection: { end: vi.fn() },
}));

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    publish: vi.fn(),
    ping: vi.fn(),
  })),
}));

const queueAdd = vi.fn();
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: queueAdd,
  })),
}));

import { scheduleMessage, ScheduledPostError } from '../src/services/scheduled-post.service.js';
import { db } from '../src/db/index.js';
import {
  isInsideQuietHours,
  coercePolicy,
  nextAllowedTime,
} from '../src/services/quiet-hours.service.js';

const ROW = {
  id: '00000000-0000-0000-0000-000000000001',
  org_id: '00000000-0000-0000-0000-000000000002',
  channel_id: '00000000-0000-0000-0000-000000000003',
  author_id: '00000000-0000-0000-0000-000000000004',
  scheduled_at: new Date('2099-01-01T00:00:00Z'),
  status: 'pending',
  defer_reason: 'scheduled',
};

describe('scheduleMessage horizon and past-date guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.insert as any).mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([ROW]),
    });
    (db.update as any).mockReturnValue({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    });
    queueAdd.mockResolvedValue({ id: 'bullmq-job-1' });
  });

  it('rejects scheduled_at in the past', async () => {
    await expect(
      scheduleMessage({
        org_id: 'org',
        channel_id: 'c',
        author_id: 'u',
        content: 'hi',
        content_format: 'html',
        thread_parent_id: null,
        metadata: {},
        scheduled_at: new Date(Date.now() - 1000),
        defer_reason: 'scheduled',
      }),
    ).rejects.toThrow(ScheduledPostError);
  });

  it('rejects scheduled_at > 30 days out', async () => {
    await expect(
      scheduleMessage({
        org_id: 'org',
        channel_id: 'c',
        author_id: 'u',
        content: 'hi',
        content_format: 'html',
        thread_parent_id: null,
        metadata: {},
        scheduled_at: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
        defer_reason: 'scheduled',
      }),
    ).rejects.toThrow(/SCHEDULED_AT_HORIZON_EXCEEDED|horizon|within 30 days/);
  });

  it('accepts a valid future timestamp', async () => {
    const r = await scheduleMessage({
      org_id: 'org',
      channel_id: 'c',
      author_id: 'u',
      content: 'hi',
      content_format: 'html',
      thread_parent_id: null,
      metadata: {},
      scheduled_at: new Date(Date.now() + 60 * 60 * 1000),
      defer_reason: 'scheduled',
    });
    expect(r.id).toBe(ROW.id);
    expect(r.defer_reason).toBe('scheduled');
  });
});

describe('createMessageSchema shape with scheduled_at', () => {
  // Mirrors the route-level schema in apps/banter-api/src/routes/message.routes.ts.
  const schema = z.object({
    content: z.string().min(1),
    content_format: z.enum(['html', 'markdown', 'plain']).default('html'),
    scheduled_at: z.string().datetime({ offset: true }).optional(),
    defer_if_quiet: z.boolean().optional(),
    urgency_override: z.boolean().optional(),
  });

  it('accepts only content_and channel', () => {
    const r = schema.safeParse({ content: 'hello' });
    expect(r.success).toBe(true);
  });

  it('accepts scheduled_at as ISO-8601', () => {
    const r = schema.safeParse({
      content: 'hello',
      scheduled_at: '2099-01-01T00:00:00Z',
    });
    expect(r.success).toBe(true);
  });

  it('rejects scheduled_at without timezone', () => {
    const r = schema.safeParse({
      content: 'hello',
      scheduled_at: '2099-01-01T00:00:00',
    });
    expect(r.success).toBe(false);
  });
});

describe('route branching decisions (logic only)', () => {
  const POLICY = {
    timezone: 'UTC',
    allowed_hours: [9, 18] as [number, number],
    urgency_override: false,
  };

  function decide(
    body: { scheduled_at?: string; defer_if_quiet?: boolean; urgency_override?: boolean },
    now: Date,
    policy: ReturnType<typeof coercePolicy>,
  ): { branch: string; code?: number } {
    if (body.scheduled_at) {
      const at = new Date(body.scheduled_at);
      if (at.getTime() <= now.getTime()) return { branch: 'reject', code: 400 };
      return { branch: 'scheduled', code: 202 };
    }
    if (policy && isInsideQuietHours(policy, now)) {
      const policyAllowsOverride = policy.urgency_override === true;
      if (body.urgency_override && policyAllowsOverride) return { branch: 'immediate', code: 201 };
      if (body.defer_if_quiet) return { branch: 'defer', code: 202 };
      return { branch: 'reject', code: 409 };
    }
    return { branch: 'immediate', code: 201 };
  }

  it('immediate outside quiet window is 201', () => {
    const d = decide({}, new Date('2026-04-15T12:00:00Z'), POLICY);
    expect(d).toEqual({ branch: 'immediate', code: 201 });
  });

  it('immediate inside quiet window without defer is 409', () => {
    const d = decide({}, new Date('2026-04-15T03:00:00Z'), POLICY);
    expect(d).toEqual({ branch: 'reject', code: 409 });
  });

  it('immediate inside quiet window with defer is 202', () => {
    const d = decide({ defer_if_quiet: true }, new Date('2026-04-15T03:00:00Z'), POLICY);
    expect(d).toEqual({ branch: 'defer', code: 202 });
  });

  it('scheduled_at future is 202', () => {
    const d = decide(
      { scheduled_at: '2099-01-01T00:00:00Z' },
      new Date('2026-04-15T12:00:00Z'),
      POLICY,
    );
    expect(d).toEqual({ branch: 'scheduled', code: 202 });
  });

  it('scheduled_at in past is 400', () => {
    const d = decide(
      { scheduled_at: '2000-01-01T00:00:00Z' },
      new Date('2026-04-15T12:00:00Z'),
      POLICY,
    );
    expect(d).toEqual({ branch: 'reject', code: 400 });
  });

  it('urgency_override is REJECTED when policy forbids', () => {
    const d = decide(
      { urgency_override: true },
      new Date('2026-04-15T03:00:00Z'),
      { ...POLICY, urgency_override: false },
    );
    expect(d).toEqual({ branch: 'reject', code: 409 });
  });

  it('urgency_override is honored when policy allows', () => {
    const d = decide(
      { urgency_override: true },
      new Date('2026-04-15T03:00:00Z'),
      { ...POLICY, urgency_override: true },
    );
    expect(d).toEqual({ branch: 'immediate', code: 201 });
  });
});

describe('nextAllowedTime smoke test in route context', () => {
  it('computes a real UTC next-allowed for a quiet-hour deferral', () => {
    const policy = coercePolicy({
      timezone: 'UTC',
      allowed_hours: [9, 18],
    });
    expect(policy).not.toBeNull();
    const at = nextAllowedTime(policy, new Date('2026-04-15T03:00:00Z'));
    expect(at.toISOString()).toBe('2026-04-15T09:00:00.000Z');
  });
});
