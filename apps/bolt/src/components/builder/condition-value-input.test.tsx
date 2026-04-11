/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConditionValueInput } from './condition-value-input';

// Mock useTemplateSuggestions — not under test here
vi.mock('@/hooks/use-template-suggestions', () => ({
  useTemplateSuggestions: () => [],
}));

// Minimal wrapper to suppress React warnings about missing QueryClient
function renderInput(props: Parameters<typeof ConditionValueInput>[0]) {
  return render(<ConditionValueInput {...props} />);
}

describe('ConditionValueInput', () => {
  it('renders nothing for is_empty operator', () => {
    const { container } = renderInput({
      operator: 'is_empty',
      value: '',
      onChange: vi.fn(),
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for is_not_empty operator', () => {
    const { container } = renderInput({
      operator: 'is_not_empty',
      value: '',
      onChange: vi.fn(),
    });
    expect(container.firstChild).toBeNull();
  });

  it('renders chip input for "in" operator', () => {
    renderInput({
      operator: 'in',
      value: ['a', 'b'],
      onChange: vi.fn(),
    });
    // Chip input shows existing chips
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('renders chip input for "not_in" operator', () => {
    renderInput({
      operator: 'not_in',
      value: [],
      onChange: vi.fn(),
    });
    expect(screen.getByPlaceholderText(/Enter to add/i)).toBeInTheDocument();
  });

  it('chip input: Enter key adds a chip', () => {
    const onChange = vi.fn();
    renderInput({ operator: 'in', value: [], onChange });
    const input = screen.getByPlaceholderText(/Enter to add/i);
    fireEvent.change(input, { target: { value: 'new-chip' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['new-chip']);
  });

  it('chip input: Backspace on empty input removes last chip', () => {
    const onChange = vi.fn();
    renderInput({ operator: 'in', value: ['first', 'second'], onChange });
    // Find the text input (no placeholder since chips present)
    const inputs = screen.getAllByRole('textbox');
    const textInput = inputs[inputs.length - 1] as HTMLInputElement;
    fireEvent.keyDown(textInput, { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith(['first']);
  });

  it('renders <select> for enum fieldType with enum values', () => {
    renderInput({
      operator: 'equals',
      fieldType: 'enum',
      fieldEnum: ['low', 'medium', 'high', 'urgent'],
      value: 'medium',
      onChange: vi.fn(),
    });
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('medium');
    expect(screen.getByRole('option', { name: 'low' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'urgent' })).toBeInTheDocument();
  });

  it('calls onChange when enum select changes', () => {
    const onChange = vi.fn();
    renderInput({
      operator: 'equals',
      fieldType: 'enum',
      fieldEnum: ['low', 'medium', 'high'],
      value: 'low',
      onChange,
    });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'high' } });
    expect(onChange).toHaveBeenCalledWith('high');
  });

  it('renders date input for date fieldType', () => {
    renderInput({
      operator: 'equals',
      fieldType: 'date',
      value: '2025-01-01',
      onChange: vi.fn(),
    });
    const input = screen.getByDisplayValue('2025-01-01') as HTMLInputElement;
    expect(input.type).toBe('date');
  });

  it('renders number input for number fieldType', () => {
    renderInput({
      operator: 'equals',
      fieldType: 'number',
      value: 42,
      onChange: vi.fn(),
    });
    const input = screen.getByDisplayValue('42') as HTMLInputElement;
    expect(input.type).toBe('number');
  });

  it('calls onChange with numeric value for number input', () => {
    const onChange = vi.fn();
    renderInput({ operator: 'equals', fieldType: 'number', value: 0, onChange });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '99' } });
    expect(onChange).toHaveBeenCalledWith(99);
  });

  it('renders yes/no radios for boolean fieldType', () => {
    renderInput({
      operator: 'equals',
      fieldType: 'boolean',
      value: true,
      onChange: vi.fn(),
    });
    expect(screen.getByLabelText('Yes')).toBeInTheDocument();
    expect(screen.getByLabelText('No')).toBeInTheDocument();
    const yesRadio = screen.getByLabelText('Yes') as HTMLInputElement;
    expect(yesRadio.checked).toBe(true);
  });

  it('renders TemplateInput for unknown fieldType (backwards compat)', () => {
    renderInput({
      operator: 'equals',
      fieldType: undefined,
      value: 'foo',
      onChange: vi.fn(),
    });
    const input = screen.getByDisplayValue('foo') as HTMLInputElement;
    expect(input.type).toBe('text');
  });

  it('renders TemplateInput for string fieldType', () => {
    renderInput({
      operator: 'equals',
      fieldType: 'string',
      value: 'bar',
      onChange: vi.fn(),
    });
    const input = screen.getByDisplayValue('bar') as HTMLInputElement;
    expect(input.type).toBe('text');
  });

  it('template toggle button switches to template mode from enum', () => {
    renderInput({
      operator: 'equals',
      fieldType: 'enum',
      fieldEnum: ['low', 'medium', 'high'],
      value: 'low',
      onChange: vi.fn(),
    });
    // Select is present before toggle
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    // Click "Use template" button
    fireEvent.click(screen.getByTitle(/Use a template/i));
    // Select should be gone; text input should be present
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByPlaceholderText('{{ template }}')).toBeInTheDocument();
  });
});
