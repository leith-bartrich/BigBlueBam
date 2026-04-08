import { describe, it, expect } from 'vitest';
import {
  cn,
  formatDate,
  formatRelativeTime,
  formatProgress,
  daysRemaining,
  generateAvatarInitials,
  truncate,
  clamp,
} from '@/lib/utils';

describe('cn', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('handles undefined and null values', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });
});

describe('formatDate', () => {
  it('formats a valid ISO date string', () => {
    expect(formatDate('2025-03-15T12:00:00Z')).toBe('Mar 15, 2025');
  });

  it('returns empty string for null', () => {
    expect(formatDate(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatDate(undefined)).toBe('');
  });

  it('returns the original string for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatRelativeTime', () => {
  it('returns empty string for null', () => {
    expect(formatRelativeTime(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('');
  });

  it('returns relative string containing "ago" for past dates', () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(pastDate)).toContain('ago');
  });
});

describe('formatProgress', () => {
  it('returns "0%" for null', () => {
    expect(formatProgress(null)).toBe('0%');
  });

  it('returns "0%" for undefined', () => {
    expect(formatProgress(undefined)).toBe('0%');
  });

  it('formats a number as a percentage string', () => {
    expect(formatProgress(50)).toBe('50%');
  });

  it('rounds to the nearest integer', () => {
    expect(formatProgress(33.7)).toBe('34%');
  });

  it('clamps values above 100 to 100', () => {
    expect(formatProgress(150)).toBe('100%');
  });

  it('clamps negative values to 0', () => {
    expect(formatProgress(-10)).toBe('0%');
  });

  it('formats 0 correctly', () => {
    expect(formatProgress(0)).toBe('0%');
  });

  it('formats 100 correctly', () => {
    expect(formatProgress(100)).toBe('100%');
  });
});

describe('daysRemaining', () => {
  it('returns null for null input', () => {
    expect(daysRemaining(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(daysRemaining(undefined)).toBeNull();
  });

  it('returns NaN for invalid date string', () => {
    // differenceInDays returns NaN for invalid inputs rather than throwing
    const result = daysRemaining('not-a-date');
    expect(result).toBeNaN();
  });

  it('returns positive number for future dates', () => {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const result = daysRemaining(futureDate);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThanOrEqual(9);
    expect(result!).toBeLessThanOrEqual(10);
  });

  it('returns negative number for past/overdue dates', () => {
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const result = daysRemaining(pastDate);
    expect(result).not.toBeNull();
    expect(result!).toBeLessThanOrEqual(-4);
    expect(result!).toBeGreaterThanOrEqual(-5);
  });
});

describe('generateAvatarInitials', () => {
  it('returns initials from two-word name', () => {
    expect(generateAvatarInitials('Jane Doe')).toBe('JD');
  });

  it('returns first two chars for single word', () => {
    expect(generateAvatarInitials('Jane')).toBe('JA');
  });

  it('returns ? for null', () => {
    expect(generateAvatarInitials(null)).toBe('?');
  });

  it('returns ? for undefined', () => {
    expect(generateAvatarInitials(undefined)).toBe('?');
  });

  it('returns ? for empty string', () => {
    expect(generateAvatarInitials('')).toBe('?');
  });
});

describe('truncate', () => {
  it('truncates long strings with ellipsis', () => {
    expect(truncate('Hello World, this is long', 10)).toBe('Hello Worl...');
  });

  it('returns the string as-is when under the limit', () => {
    expect(truncate('Short', 10)).toBe('Short');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });
});

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('clamps to min when value is below range', () => {
    expect(clamp(-10, 0, 100)).toBe(0);
  });

  it('clamps to max when value is above range', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });
});
