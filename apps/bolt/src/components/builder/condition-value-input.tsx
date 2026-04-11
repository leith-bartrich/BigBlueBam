import { useState, useRef, type KeyboardEvent } from 'react';
import { X, Code2 } from 'lucide-react';
import { TemplateInput } from '@/components/builder/template-input';
import { useTemplateSuggestions } from '@/hooks/use-template-suggestions';
import type { TriggerSource } from '@/hooks/use-automations';
import { cn } from '@/lib/utils';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ConditionValueInputProps {
  operator: string;
  /** Resolved from the selected field's PayloadFieldDef.type. */
  fieldType?: string;
  /** Resolved from the selected field's PayloadFieldDef.enum when type === 'enum'. */
  fieldEnum?: string[];
  value: unknown;
  onChange: (value: unknown) => void;
  triggerSource?: TriggerSource;
  triggerEvent?: string;
  stepCount?: number;
  className?: string;
}

// ─── Operators that hide the value field ─────────────────────────────────────

const NO_VALUE_OPERATORS = new Set(['is_empty', 'is_not_empty']);
const MULTI_VALUE_OPERATORS = new Set(['in', 'not_in']);

// ─── Chip multi-value input ───────────────────────────────────────────────────

interface ChipInputProps {
  value: unknown;
  onChange: (value: unknown) => void;
  className?: string;
}

function toChips(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.length > 0) return [value];
  return [];
}

function ChipInput({ value, onChange, className }: ChipInputProps) {
  const chips = toChips(value);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addChip = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onChange([...chips, trimmed]);
    setDraft('');
  };

  const removeChip = (index: number) => {
    onChange(chips.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChip(draft);
    } else if (e.key === 'Backspace' && draft === '' && chips.length > 0) {
      removeChip(chips.length - 1);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-wrap gap-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 cursor-text focus-within:ring-2 focus-within:ring-amber-500 focus-within:border-amber-500 dark:bg-zinc-900 dark:border-zinc-700',
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {chips.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
        >
          {chip}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeChip(i); }}
            className="text-amber-600 hover:text-amber-800 dark:text-amber-400"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (draft.trim()) addChip(draft); }}
        placeholder={chips.length === 0 ? 'value or {{ template }}, Enter to add' : ''}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
      />
    </div>
  );
}

// ─── Use-template toggle wrapper ─────────────────────────────────────────────

interface TemplateToggleProps {
  children: React.ReactNode;
  onUseTemplate: () => void;
}

function TemplateToggle({ children, onUseTemplate }: TemplateToggleProps) {
  return (
    <div className="flex items-center gap-1 flex-1 min-w-0">
      {children}
      <button
        type="button"
        onClick={onUseTemplate}
        title="Use a template expression instead"
        className="shrink-0 p-1.5 rounded text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
      >
        <Code2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConditionValueInput({
  operator,
  fieldType,
  fieldEnum,
  value,
  onChange,
  triggerSource,
  triggerEvent,
  stepCount = 0,
  className,
}: ConditionValueInputProps) {
  const [templateMode, setTemplateMode] = useState(false);

  const suggestions = useTemplateSuggestions({
    triggerSource,
    triggerEvent,
    stepCount,
    fieldType,
  });

  const inputClassName = cn(
    'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900',
    'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500',
    'dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700',
    className,
  );

  // 1. No-value operators — render nothing
  if (NO_VALUE_OPERATORS.has(operator)) {
    return null;
  }

  // 2. Multi-value operators — chip input
  if (MULTI_VALUE_OPERATORS.has(operator)) {
    return <ChipInput value={value} onChange={onChange} className={className} />;
  }

  // 3. Template mode — always show TemplateInput regardless of field type
  if (templateMode) {
    return (
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <TemplateInput
          value={String(value ?? '')}
          onChange={(v) => onChange(v)}
          suggestions={suggestions}
          placeholder="{{ template }}"
          className={inputClassName}
        />
        <button
          type="button"
          onClick={() => { setTemplateMode(false); onChange(''); }}
          title="Switch back to structured input"
          className="shrink-0 p-1.5 rounded text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 transition-colors"
        >
          <Code2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // 4. Enum field — select + template toggle
  if (fieldType === 'enum' && fieldEnum && fieldEnum.length > 0) {
    return (
      <TemplateToggle onUseTemplate={() => { setTemplateMode(true); onChange(''); }}>
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
        >
          <option value="">— select —</option>
          {fieldEnum.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </TemplateToggle>
    );
  }

  // 5. Date field — date input + template toggle
  if (fieldType === 'date') {
    return (
      <TemplateToggle onUseTemplate={() => { setTemplateMode(true); onChange(''); }}>
        <input
          type="date"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
        />
      </TemplateToggle>
    );
  }

  // 6. Number field — number input + template toggle
  if (fieldType === 'number') {
    return (
      <TemplateToggle onUseTemplate={() => { setTemplateMode(true); onChange(''); }}>
        <input
          type="number"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="number"
          className={inputClassName}
        />
      </TemplateToggle>
    );
  }

  // 7. Boolean field — yes/no radio + template toggle
  if (fieldType === 'boolean') {
    const boolVal = value === true || value === 'true';
    return (
      <TemplateToggle onUseTemplate={() => { setTemplateMode(true); onChange(''); }}>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex-1">
          <label className="flex items-center gap-1.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="radio"
              name={`bool-${Math.random()}`}
              checked={boolVal === true}
              onChange={() => onChange(true)}
              className="accent-amber-500"
            />
            Yes
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="radio"
              name={`bool-${Math.random()}`}
              checked={boolVal === false}
              onChange={() => onChange(false)}
              className="accent-amber-500"
            />
            No
          </label>
        </div>
      </TemplateToggle>
    );
  }

  // 8. String / unknown / uuid — TemplateInput (backwards-compatible default)
  return (
    <TemplateInput
      value={String(value ?? '')}
      onChange={(v) => onChange(v)}
      suggestions={suggestions}
      placeholder="value or {{ template }}"
      className={inputClassName}
    />
  );
}
