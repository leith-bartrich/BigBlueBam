import { describe, it, expect } from 'vitest';
import {
  cn,
  generateAvatarInitials,
  priorityColor,
  stateColor,
  formatDate,
  isOverdue,
  truncate,
  formatRelativeTime,
  priorityIcon,
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

describe('generateAvatarInitials', () => {
  it('returns initials from two-word name', () => {
    expect(generateAvatarInitials('Jane Doe')).toBe('JD');
  });

  it('returns initials from three-word name (first and last)', () => {
    expect(generateAvatarInitials('Mary Jane Watson')).toBe('MW');
  });

  it('returns first two chars from single word', () => {
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

  it('uppercases the result', () => {
    expect(generateAvatarInitials('alice bob')).toBe('AB');
  });
});

describe('priorityColor', () => {
  it('returns correct color for critical', () => {
    expect(priorityColor('critical')).toContain('text-priority-critical');
    expect(priorityColor('critical')).toContain('bg-red-50');
  });

  it('returns correct color for high', () => {
    expect(priorityColor('high')).toContain('text-priority-high');
    expect(priorityColor('high')).toContain('bg-orange-50');
  });

  it('returns correct color for medium', () => {
    expect(priorityColor('medium')).toContain('text-priority-medium');
    expect(priorityColor('medium')).toContain('bg-yellow-50');
  });

  it('returns correct color for low', () => {
    expect(priorityColor('low')).toContain('text-priority-low');
    expect(priorityColor('low')).toContain('bg-blue-50');
  });

  it('returns correct color for none', () => {
    expect(priorityColor('none')).toContain('text-priority-none');
    expect(priorityColor('none')).toContain('bg-zinc-50');
  });
});

describe('stateColor', () => {
  it('returns correct color for todo', () => {
    expect(stateColor('todo')).toBe('bg-state-todo');
  });

  it('returns correct color for active', () => {
    expect(stateColor('active')).toBe('bg-state-active');
  });

  it('returns correct color for blocked', () => {
    expect(stateColor('blocked')).toBe('bg-state-blocked');
  });

  it('returns correct color for review', () => {
    expect(stateColor('review')).toBe('bg-state-review');
  });

  it('returns correct color for done', () => {
    expect(stateColor('done')).toBe('bg-state-done');
  });

  it('returns correct color for cancelled', () => {
    expect(stateColor('cancelled')).toBe('bg-state-cancelled');
  });

  it('returns fallback for unknown category', () => {
    expect(stateColor('unknown' as any)).toBe('bg-zinc-400');
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

describe('isOverdue', () => {
  it('returns true for a past date', () => {
    expect(isOverdue('2020-01-01T00:00:00Z')).toBe(true);
  });

  it('returns false for a far future date', () => {
    expect(isOverdue('2099-12-31T23:59:59Z')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isOverdue(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isOverdue(undefined)).toBe(false);
  });

  it('returns false for invalid date string', () => {
    expect(isOverdue('not-a-date')).toBe(false);
  });
});

describe('truncate', () => {
  it('truncates long strings with ellipsis', () => {
    expect(truncate('Hello World, this is a long string', 10)).toBe('Hello Worl...');
  });

  it('returns the string as-is when under the limit', () => {
    expect(truncate('Short', 10)).toBe('Short');
  });

  it('returns the string as-is when exactly at the limit', () => {
    expect(truncate('1234567890', 10)).toBe('1234567890');
  });

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('');
  });
});

describe('priorityIcon', () => {
  it('returns AlertTriangle for critical', () => {
    expect(priorityIcon('critical')).toBe('AlertTriangle');
  });

  it('returns ArrowUp for high', () => {
    expect(priorityIcon('high')).toBe('ArrowUp');
  });

  it('returns Minus for medium', () => {
    expect(priorityIcon('medium')).toBe('Minus');
  });

  it('returns ArrowDown for low', () => {
    expect(priorityIcon('low')).toBe('ArrowDown');
  });

  it('returns Minus for none', () => {
    expect(priorityIcon('none')).toBe('Minus');
  });
});
