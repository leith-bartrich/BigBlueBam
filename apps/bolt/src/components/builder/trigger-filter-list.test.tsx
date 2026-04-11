/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TriggerFilterList } from './trigger-filter-list';

// Mock ConditionRow to avoid deep dependency chain in unit tests
vi.mock('./condition-row', () => ({
  ConditionRow: ({ condition, onChange, onRemove }: {
    condition: { id: string; field: string; value: unknown };
    onChange: (c: { id: string; field: string; operator: string; value: unknown; logic_group: string; sort_order: number }) => void;
    onRemove: () => void;
  }) => (
    <div data-testid={`row-${condition.id}`}>
      <input
        aria-label="field"
        value={condition.field}
        onChange={(e) => onChange({ ...condition, operator: 'equals', logic_group: 'and', sort_order: 0, field: e.target.value })}
      />
      <input
        aria-label="value"
        value={String(condition.value ?? '')}
        onChange={(e) => onChange({ ...condition, operator: 'equals', logic_group: 'and', sort_order: 0, value: e.target.value })}
      />
      <button type="button" onClick={onRemove}>remove</button>
    </div>
  ),
}));

describe('TriggerFilterList', () => {
  it('renders one row per key in the freeform object', () => {
    render(
      <TriggerFilterList
        value={{ status: 'active', priority: 'high' }}
        onChange={vi.fn()}
      />,
    );
    const fieldInputs = screen.getAllByRole('textbox', { name: /field/i });
    expect(fieldInputs).toHaveLength(2);
  });

  it('round-trips: value change propagates correct key/value to onChange', () => {
    const onChange = vi.fn();
    const input = { foo: 'bar', baz: 'qux' };

    render(<TriggerFilterList value={input} onChange={onChange} />);

    // Change the value of the first row
    const valueInputs = screen.getAllByRole('textbox', { name: /^value$/i });
    fireEvent.change(valueInputs[0]!, { target: { value: 'updated' } });

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as Record<string, unknown>;
    // One of the keys should now have the updated value
    const values = Object.values(lastCall);
    expect(values).toContain('updated');
  });

  it('adds a new empty row when "Add filter rule" is clicked', () => {
    const onChange = vi.fn();
    render(<TriggerFilterList value={{}} onChange={onChange} />);

    const addBtn = screen.getByText(/Add filter rule/i);
    fireEvent.click(addBtn);

    // A new empty row should appear
    const fieldInputs = screen.getAllByRole('textbox', { name: /field/i });
    expect(fieldInputs).toHaveLength(1);
  });

  it('removes a row and calls onChange without that key', () => {
    const onChange = vi.fn();
    render(
      <TriggerFilterList
        value={{ keep: 'me', remove: 'me' }}
        onChange={onChange}
      />,
    );
    const removeButtons = screen.getAllByText('remove');
    // Click second row's remove
    fireEvent.click(removeButtons[1]!);
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as Record<string, unknown>;
    expect(Object.keys(lastCall)).toHaveLength(1);
  });

  it('shows no-filter message when value is empty', () => {
    render(<TriggerFilterList value={{}} onChange={vi.fn()} />);
    expect(screen.getByText(/No filter rules/i)).toBeInTheDocument();
  });

  it('renders complex values as JSON textarea (not ConditionRow)', () => {
    render(
      <TriggerFilterList
        value={{ nested: { foo: 'bar' } }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Complex filter/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument(); // the textarea
  });
});
