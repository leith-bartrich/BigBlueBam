import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
  type ChangeEvent,
  type InputHTMLAttributes,
} from 'react';
import type { TemplateSuggestion } from '@/hooks/use-template-suggestions';
import { cn } from '@/lib/utils';

// ─── Detection / insertion helpers ───────────────────────────────────

/**
 * Look backwards from the caret for the most recent `{{` that hasn't already
 * been closed with `}}`. Returns the start index of the `{{` and the text
 * between `{{` and the caret (trimmed of leading whitespace).
 */
function findOpenTemplate(
  value: string,
  caret: number,
): { start: number; prefix: string } | null {
  const before = value.slice(0, caret);
  const lastOpen = before.lastIndexOf('{{');
  if (lastOpen === -1) return null;
  const inside = before.slice(lastOpen + 2);
  if (inside.includes('}}')) return null;
  return { start: lastOpen, prefix: inside.trimStart() };
}

/**
 * Replace the `{{ ... ` fragment immediately before the caret with the full
 * `{{ <path> }}` insertion. Returns the new value and the new caret position.
 */
function insertSuggestion(
  value: string,
  caret: number,
  path: string,
): { value: string; caret: number } {
  const info = findOpenTemplate(value, caret);
  if (!info) return { value, caret };
  const before = value.slice(0, info.start);
  const after = value.slice(caret);
  const insertion = `{{ ${path} }}`;
  return {
    value: before + insertion + after,
    caret: before.length + insertion.length,
  };
}

// ─── Suggestion filtering ────────────────────────────────────────────

/**
 * Rank suggestions against the prefix. Prefer startsWith matches over
 * substring matches; fall back to all suggestions when prefix is empty.
 */
function filterSuggestions(
  suggestions: TemplateSuggestion[],
  prefix: string,
  limit = 12,
): TemplateSuggestion[] {
  if (!prefix) return suggestions.slice(0, limit);
  const lower = prefix.toLowerCase();
  const starts: TemplateSuggestion[] = [];
  const contains: TemplateSuggestion[] = [];
  for (const s of suggestions) {
    const path = s.path.toLowerCase();
    if (path.startsWith(lower)) starts.push(s);
    else if (path.includes(lower)) contains.push(s);
  }
  return [...starts, ...contains].slice(0, limit);
}

// ─── Component ───────────────────────────────────────────────────────

type BaseInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
>;

interface TemplateInputProps extends BaseInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: TemplateSuggestion[];
  className?: string;
}

const CATEGORY_LABEL: Record<TemplateSuggestion['category'], string> = {
  event: 'Event payload',
  actor: 'Actor',
  automation: 'Automation',
  system: 'System',
  step: 'Previous step',
};

const CATEGORY_COLOR: Record<TemplateSuggestion['category'], string> = {
  event: 'text-blue-600 dark:text-blue-400',
  actor: 'text-purple-600 dark:text-purple-400',
  automation: 'text-amber-600 dark:text-amber-400',
  system: 'text-zinc-500 dark:text-zinc-400',
  step: 'text-green-600 dark:text-green-400',
};

export function TemplateInput({
  value,
  onChange,
  suggestions,
  className,
  onKeyDown,
  ...rest
}: TemplateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [caret, setCaret] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  // Derive whether we're currently inside an open {{ ... and what's typed so
  // far. If not inside a template, the popup stays hidden.
  const openTemplate = useMemo(
    () => (isOpen ? findOpenTemplate(value, caret) : null),
    [isOpen, value, caret],
  );

  const filtered = useMemo(() => {
    if (!openTemplate) return [];
    return filterSuggestions(suggestions, openTemplate.prefix);
  }, [openTemplate, suggestions]);

  // Keep the highlight in range when the filtered list changes
  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(0);
  }, [filtered.length, highlight]);

  const showPopup = isOpen && openTemplate !== null && filtered.length > 0;

  const applySuggestion = useCallback(
    (path: string) => {
      const result = insertSuggestion(value, caret, path);
      onChange(result.value);
      setIsOpen(false);
      // Restore caret position on the next tick, after React flushes the new value.
      queueMicrotask(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(result.caret, result.caret);
        setCaret(result.caret);
      });
    },
    [value, caret, onChange],
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value;
    const nextCaret = e.target.selectionStart ?? nextValue.length;
    onChange(nextValue);
    setCaret(nextCaret);
    // Open the popup whenever the user is inside an unclosed {{ ... fragment.
    const open = findOpenTemplate(nextValue, nextCaret);
    setIsOpen(open !== null);
    setHighlight(0);
  };

  const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    setCaret(el.selectionStart ?? 0);
    const open = findOpenTemplate(el.value, el.selectionStart ?? 0);
    setIsOpen(open !== null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showPopup) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const choice = filtered[highlight];
        if (choice) {
          e.preventDefault();
          applySuggestion(choice.path);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative flex-1 min-w-0">
      <input
        {...rest}
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Delay so click handlers on the popup fire before we hide it.
          window.setTimeout(() => setIsOpen(false), 150);
        }}
        className={className}
      />

      {showPopup && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
            Template suggestions — ↑↓ select, Enter to insert, Esc to dismiss
          </div>
          {filtered.map((s, idx) => (
            <button
              key={s.path}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applySuggestion(s.path)}
              className={cn(
                'w-full text-left px-3 py-1.5 flex items-start gap-2 border-b border-zinc-50 dark:border-zinc-800/50 last:border-b-0',
                idx === highlight
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100 truncate">
                    {s.path}
                  </span>
                  <span className="text-[10px] rounded px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                    {s.type}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {s.description}
                </div>
              </div>
              <span className={cn('text-[10px] shrink-0 uppercase tracking-wider', CATEGORY_COLOR[s.category])}>
                {CATEGORY_LABEL[s.category]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
