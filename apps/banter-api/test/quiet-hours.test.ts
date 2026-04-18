// §13 Wave 4 scheduled banter — tests for quiet-hours evaluation and
// next-allowed-time computation.

import { describe, it, expect } from 'vitest';
import {
  isInsideQuietHours,
  nextAllowedTime,
  validateQuietHoursPolicy,
  isValidIanaTimezone,
  type QuietHoursPolicy,
} from '../src/services/quiet-hours.service.js';

const LA: QuietHoursPolicy = {
  timezone: 'America/Los_Angeles',
  allowed_hours: [9, 18],
};

const NY: QuietHoursPolicy = {
  timezone: 'America/New_York',
  allowed_hours: [9, 18],
};

const UTC_9_18: QuietHoursPolicy = {
  timezone: 'UTC',
  allowed_hours: [9, 18],
};

describe('isValidIanaTimezone', () => {
  it('accepts common IANA zones', () => {
    expect(isValidIanaTimezone('UTC')).toBe(true);
    expect(isValidIanaTimezone('America/Los_Angeles')).toBe(true);
    expect(isValidIanaTimezone('Europe/Paris')).toBe(true);
    expect(isValidIanaTimezone('Asia/Tokyo')).toBe(true);
  });
  it('rejects bogus strings', () => {
    expect(isValidIanaTimezone('Nowhere/Atlantis')).toBe(false);
    expect(isValidIanaTimezone('')).toBe(false);
    // @ts-expect-error intentional type coercion test
    expect(isValidIanaTimezone(undefined)).toBe(false);
  });
});

describe('validateQuietHoursPolicy', () => {
  it('accepts a well-formed policy', () => {
    const r = validateQuietHoursPolicy({
      timezone: 'UTC',
      allowed_hours: [9, 18],
      weekday_only: true,
    });
    expect(r.ok).toBe(true);
    expect(r.policy).toBeDefined();
  });
  it('rejects invalid timezone', () => {
    const r = validateQuietHoursPolicy({
      timezone: 'Bogus/Zone',
      allowed_hours: [9, 18],
    });
    expect(r.ok).toBe(false);
    expect(r.issues?.some((i) => i.field === 'timezone')).toBe(true);
  });
  it('rejects start === end', () => {
    const r = validateQuietHoursPolicy({
      timezone: 'UTC',
      allowed_hours: [9, 9],
    });
    expect(r.ok).toBe(false);
    expect(r.issues?.some((i) => i.field === 'allowed_hours')).toBe(true);
  });
  it('rejects hours out of range', () => {
    const r = validateQuietHoursPolicy({
      timezone: 'UTC',
      allowed_hours: [0, 25],
    });
    expect(r.ok).toBe(false);
  });
});

describe('isInsideQuietHours', () => {
  it('returns false when policy is null', () => {
    expect(isInsideQuietHours(null, new Date())).toBe(false);
    expect(isInsideQuietHours(undefined, new Date())).toBe(false);
  });

  it('UTC 03:00 with allowed [9,18] is inside quiet', () => {
    const t = new Date('2026-04-15T03:00:00Z');
    expect(isInsideQuietHours(UTC_9_18, t)).toBe(true);
  });

  it('UTC 12:00 with allowed [9,18] is outside quiet', () => {
    const t = new Date('2026-04-15T12:00:00Z');
    expect(isInsideQuietHours(UTC_9_18, t)).toBe(false);
  });

  it('LA 16:00 UTC = 9am LA is just inside allowed [9,18]', () => {
    // 2026-04-15 is during PDT (UTC-7). 16:00 UTC = 09:00 LA.
    const t = new Date('2026-04-15T16:00:00Z');
    expect(isInsideQuietHours(LA, t)).toBe(false);
  });

  it('LA 02:00 UTC = 19:00 previous day LA is inside quiet', () => {
    // 02:00 UTC on 2026-04-15 = 19:00 PDT on 2026-04-14 (hour 19 > 18 → quiet).
    const t = new Date('2026-04-15T02:00:00Z');
    expect(isInsideQuietHours(LA, t)).toBe(true);
  });

  it('handles wrapped allowed windows [22,6]', () => {
    const wrap: QuietHoursPolicy = {
      timezone: 'UTC',
      allowed_hours: [22, 6],
    };
    expect(isInsideQuietHours(wrap, new Date('2026-04-15T23:00:00Z'))).toBe(false);
    expect(isInsideQuietHours(wrap, new Date('2026-04-15T03:00:00Z'))).toBe(false);
    expect(isInsideQuietHours(wrap, new Date('2026-04-15T12:00:00Z'))).toBe(true);
  });

  it('allows always when allowed_hours is [0,24]', () => {
    const always: QuietHoursPolicy = { timezone: 'UTC', allowed_hours: [0, 24] };
    expect(isInsideQuietHours(always, new Date('2026-04-15T00:00:00Z'))).toBe(false);
    expect(isInsideQuietHours(always, new Date('2026-04-15T12:00:00Z'))).toBe(false);
    expect(isInsideQuietHours(always, new Date('2026-04-15T23:59:59Z'))).toBe(false);
  });

  it('weekday_only makes Saturday and Sunday always quiet', () => {
    const biz: QuietHoursPolicy = {
      timezone: 'UTC',
      allowed_hours: [9, 18],
      weekday_only: true,
    };
    // 2026-04-11 is Saturday, 2026-04-12 is Sunday in UTC.
    expect(isInsideQuietHours(biz, new Date('2026-04-11T12:00:00Z'))).toBe(true);
    expect(isInsideQuietHours(biz, new Date('2026-04-12T12:00:00Z'))).toBe(true);
    // 2026-04-13 is Monday
    expect(isInsideQuietHours(biz, new Date('2026-04-13T12:00:00Z'))).toBe(false);
  });
});

describe('nextAllowedTime', () => {
  it('returns `from` unchanged when already allowed', () => {
    const t = new Date('2026-04-15T12:00:00Z');
    expect(nextAllowedTime(UTC_9_18, t).getTime()).toBe(t.getTime());
  });

  it('wraps to next day when past end', () => {
    // 20:00 UTC with allowed [9,18] UTC → next allowed is tomorrow 09:00 UTC
    const t = new Date('2026-04-15T20:00:00Z');
    const next = nextAllowedTime(UTC_9_18, t);
    expect(next.toISOString()).toBe('2026-04-16T09:00:00.000Z');
  });

  it('advances to start when before window', () => {
    // 03:00 UTC with allowed [9,18] → same day 09:00 UTC
    const t = new Date('2026-04-15T03:00:00Z');
    const next = nextAllowedTime(UTC_9_18, t);
    expect(next.toISOString()).toBe('2026-04-15T09:00:00.000Z');
  });

  it('weekday_only skips Saturday and Sunday', () => {
    const biz: QuietHoursPolicy = {
      timezone: 'UTC',
      allowed_hours: [9, 18],
      weekday_only: true,
    };
    // Friday 2026-04-10 20:00 UTC (past window) → next should be Monday 2026-04-13 09:00 UTC
    const t = new Date('2026-04-10T20:00:00Z');
    const next = nextAllowedTime(biz, t);
    expect(next.toISOString()).toBe('2026-04-13T09:00:00.000Z');
  });

  it('LA DST crossover: 2026-03-08 spring-forward day', () => {
    // On 2026-03-08, LA springs forward from 02:00 PST to 03:00 PDT.
    // Policy: LA 09:00-18:00. Start from 2026-03-08T06:00:00Z (= 22:00 PST
    // on 2026-03-07, which is post-window on Saturday → quiet). With no
    // weekday_only, next allowed is 2026-03-08T17:00:00Z (= 09:00 PDT on
    // 2026-03-08 after spring-forward, UTC offset -7 now).
    const t = new Date('2026-03-08T06:00:00Z');
    const next = nextAllowedTime(LA, t);
    // 09:00 PDT on 2026-03-08 = 16:00 UTC (PDT is UTC-7)
    expect(next.toISOString()).toBe('2026-03-08T16:00:00.000Z');
  });

  it('NY allowed [9,18]: late-night request lands on next business morning', () => {
    // 2026-04-15 (Wed) 23:30 EDT = 2026-04-16T03:30:00Z, next allowed
    // 2026-04-16 09:00 EDT = 2026-04-16T13:00:00Z (EDT = UTC-4).
    const t = new Date('2026-04-16T03:30:00Z');
    const next = nextAllowedTime(NY, t);
    expect(next.toISOString()).toBe('2026-04-16T13:00:00.000Z');
  });
});
