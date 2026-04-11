import { describe, it, expect } from 'vitest';

// ─── Inline copy of getValidOperators for unit testing ───────────────────────
// We test the pure logic function independently. condition-row.tsx exports the
// full React component which needs heavier mocking, so we mirror the helper here
// and the integration is covered by condition-value-input.test.tsx.

type ConditionOperator =
  | 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with'
  | 'ends_with' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty'
  | 'in' | 'not_in' | 'matches_regex';

type OperatorDef = { value: ConditionOperator; label: string };

const ALL_OPERATORS: OperatorDef[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'not contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'in', label: 'in' },
  { value: 'not_in', label: 'not in' },
  { value: 'matches_regex', label: 'matches regex' },
];

function getValidOperators(fieldType?: string): OperatorDef[] {
  if (!fieldType) return ALL_OPERATORS;
  switch (fieldType) {
    case 'string':
      return ALL_OPERATORS.filter((op) =>
        ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with',
          'matches_regex', 'is_empty', 'is_not_empty', 'in', 'not_in'].includes(op.value),
      );
    case 'number':
    case 'date':
      return ALL_OPERATORS.filter((op) =>
        ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty',
          'in', 'not_in'].includes(op.value),
      );
    case 'boolean':
      return ALL_OPERATORS.filter((op) =>
        ['equals', 'not_equals', 'is_empty', 'is_not_empty'].includes(op.value),
      );
    case 'enum':
      return ALL_OPERATORS.filter((op) =>
        ['equals', 'not_equals', 'is_empty', 'is_not_empty', 'in', 'not_in'].includes(op.value),
      );
    default:
      return ALL_OPERATORS;
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

const vals = (ops: OperatorDef[]) => ops.map((o) => o.value);

describe('getValidOperators', () => {
  it('returns all 13 operators when fieldType is undefined', () => {
    expect(getValidOperators(undefined)).toHaveLength(13);
  });

  it('returns all 13 operators for unknown fieldType', () => {
    expect(getValidOperators('unknown_type')).toHaveLength(13);
  });

  describe('string fieldType', () => {
    it('includes string-specific ops: contains, starts_with, ends_with, matches_regex', () => {
      const ops = vals(getValidOperators('string'));
      expect(ops).toContain('contains');
      expect(ops).toContain('not_contains');
      expect(ops).toContain('starts_with');
      expect(ops).toContain('ends_with');
      expect(ops).toContain('matches_regex');
    });

    it('excludes numeric ops: greater_than, less_than', () => {
      const ops = vals(getValidOperators('string'));
      expect(ops).not.toContain('greater_than');
      expect(ops).not.toContain('less_than');
    });
  });

  describe('number fieldType', () => {
    it('includes comparison ops: greater_than, less_than', () => {
      const ops = vals(getValidOperators('number'));
      expect(ops).toContain('greater_than');
      expect(ops).toContain('less_than');
    });

    it('excludes string-only ops: contains, starts_with, ends_with, matches_regex', () => {
      const ops = vals(getValidOperators('number'));
      expect(ops).not.toContain('contains');
      expect(ops).not.toContain('not_contains');
      expect(ops).not.toContain('starts_with');
      expect(ops).not.toContain('ends_with');
      expect(ops).not.toContain('matches_regex');
    });
  });

  describe('date fieldType (same as number)', () => {
    it('includes comparison ops and excludes string-only ops', () => {
      const ops = vals(getValidOperators('date'));
      expect(ops).toContain('greater_than');
      expect(ops).toContain('less_than');
      expect(ops).not.toContain('contains');
      expect(ops).not.toContain('matches_regex');
    });
  });

  describe('boolean fieldType', () => {
    it('includes only equals, not_equals, is_empty, is_not_empty', () => {
      const ops = vals(getValidOperators('boolean'));
      expect(ops).toContain('equals');
      expect(ops).toContain('not_equals');
      expect(ops).toContain('is_empty');
      expect(ops).toContain('is_not_empty');
      expect(ops).toHaveLength(4);
    });

    it('excludes in/not_in and all string ops', () => {
      const ops = vals(getValidOperators('boolean'));
      expect(ops).not.toContain('in');
      expect(ops).not.toContain('not_in');
      expect(ops).not.toContain('contains');
    });
  });

  describe('enum fieldType', () => {
    it('includes equals, not_equals, is_empty, is_not_empty, in, not_in', () => {
      const ops = vals(getValidOperators('enum'));
      expect(ops).toContain('equals');
      expect(ops).toContain('not_equals');
      expect(ops).toContain('is_empty');
      expect(ops).toContain('is_not_empty');
      expect(ops).toContain('in');
      expect(ops).toContain('not_in');
    });

    it('excludes string-specific and numeric ops', () => {
      const ops = vals(getValidOperators('enum'));
      expect(ops).not.toContain('contains');
      expect(ops).not.toContain('greater_than');
      expect(ops).not.toContain('matches_regex');
    });
  });
});
