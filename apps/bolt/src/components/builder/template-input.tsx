import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
  type ChangeEvent,
  type InputHTMLAttributes,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
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

// ─── Viewport-aware popup positioning ────────────────────────────────
//
// The suggestion popup is rendered via a React portal into document.body so
// it can escape any `overflow: hidden` / scroll containers above the input
// (the action editor lives inside several scroll containers — without the
// portal, items past the container edge get clipped). Position is computed
// from the input's bounding rect each time the popup opens and on every
// scroll / resize while it's open. The popup flips above the input when
// there's more vertical room up than down, and its max-height is capped to
// the available space minus a small margin so the bottom never overflows.

interface PopupPosition extends CSSProperties {
  position: 'fixed';
  left: string;
  width: string;
  maxHeight: string;
  // Exactly one of these is set per render — the other defaults to 'auto'.
  top?: string;
  bottom?: string;
}

function computePopupPosition(input: HTMLInputElement): PopupPosition {
  const rect = input.getBoundingClientRect();
  const margin = 8;          // breathing room from the viewport edge
  const minHeight = 120;     // never collapse smaller than this
  const minWidth = 320;      // narrow inputs (parameter values) still get a readable popup
  const gap = 4;             // vertical gap between input and popup

  const spaceBelow = window.innerHeight - rect.bottom - margin;
  const spaceAbove = rect.top - margin;

  // Place below by default; flip above only if there's noticeably more room
  // up there. The bias prevents flickery flips when both sides are similar.
  const placeBelow = spaceBelow >= minHeight || spaceBelow + 40 >= spaceAbove;
  const availableHeight = placeBelow ? spaceBelow - gap : spaceAbove - gap;
  const maxHeight = Math.max(minHeight, availableHeight);

  // Width matches the input but is at least minWidth — and we never let the
  // right edge run off the viewport.
  const popupWidth = Math.max(rect.width, minWidth);
  let left = rect.left;
  if (left + popupWidth > window.innerWidth - margin) {
    left = window.innerWidth - popupWidth - margin;
  }
  if (left < margin) left = margin;

  const base: PopupPosition = {
    position: 'fixed',
    left: `${left}px`,
    width: `${popupWidth}px`,
    maxHeight: `${maxHeight}px`,
  };
  if (placeBelow) {
    base.top = `${rect.bottom + gap}px`;
  } else {
    base.bottom = `${window.innerHeight - rect.top + gap}px`;
  }
  return base;
}

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
  const [popupStyle, setPopupStyle] = useState<PopupPosition | null>(null);

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

  // Recompute the popup's fixed position whenever it opens, on scroll inside
  // any ancestor (capture: true catches all scroll events that bubble or
  // not), and on window resize. We don't bother with a ResizeObserver on the
  // input because the parent layout is form-based and rarely resizes
  // independently of the window.
  useEffect(() => {
    if (!showPopup) {
      setPopupStyle(null);
      return;
    }
    const update = () => {
      if (inputRef.current) {
        setPopupStyle(computePopupPosition(inputRef.current));
      }
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showPopup]);

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

      {showPopup && popupStyle && createPortal(
        <div
          style={popupStyle}
          className="z-[9999] flex flex-col overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg"
        >
          <div className="shrink-0 px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
            Template suggestions — ↑↓ select, Enter to insert, Esc to dismiss
          </div>
          <div className="flex-1 overflow-y-auto">
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
        </div>,
        document.body,
      )}
    </div>
  );
}
