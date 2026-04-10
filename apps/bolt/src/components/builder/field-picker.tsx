import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTemplateSuggestions } from '@/hooks/use-template-suggestions';
import type { TriggerSource } from '@/hooks/use-automations';

interface FieldPickerProps {
  value: string;
  onChange: (value: string) => void;
  triggerSource?: TriggerSource;
  triggerEvent?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Field-path picker used by condition rows. Sources its suggestions from the
 * live event catalog (via `useTemplateSuggestions`), narrowed by the selected
 * trigger event when one is picked. The user can still type a custom path if
 * nothing matches — we never block free-form input.
 */
export function FieldPicker({
  value,
  onChange,
  triggerSource,
  triggerEvent,
  placeholder = 'field.path',
  className,
}: FieldPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allSuggestions = useTemplateSuggestions({ triggerSource, triggerEvent });

  // Condition paths use the same `event.*` / `actor.*` prefixes as templates —
  // the bolt-api condition engine walks `{ event: event.payload, actor: ... }`
  // by dot-path, so the leading namespace is required.
  const fieldSuggestions = useMemo(
    () =>
      allSuggestions
        .filter((s) => s.category === 'event' || s.category === 'actor')
        .map((s) => ({
          path: s.path,
          type: s.type,
          description: s.description,
        })),
    [allSuggestions],
  );

  const suggestions = useMemo(() => {
    if (!filter) return fieldSuggestions;
    const lower = filter.toLowerCase();
    return fieldSuggestions.filter(
      (f) =>
        f.path.toLowerCase().includes(lower) ||
        f.description.toLowerCase().includes(lower),
    );
  }, [fieldSuggestions, filter]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (path: string) => {
    onChange(path);
    setIsOpen(false);
    setFilter('');
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={isOpen ? filter || value : value}
          onChange={(e) => {
            const v = e.target.value;
            if (isOpen) {
              setFilter(v);
            } else {
              onChange(v);
            }
          }}
          onFocus={() => {
            setIsOpen(true);
            setFilter('');
          }}
          className={
            className ??
            'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700 pr-8'
          }
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg"
        >
          {suggestions.map((s) => (
            <button
              key={s.path}
              type="button"
              onClick={() => handleSelect(s.path)}
              className="w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors border-b border-zinc-100 dark:border-zinc-700/50 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-zinc-900 dark:text-zinc-100">{s.path}</span>
                <span className="text-[10px] text-zinc-400 bg-zinc-100 dark:bg-zinc-700 rounded px-1 py-0.5">
                  {s.type}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{s.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
