import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// Generic suggestion popup used by Mention (@) and SlashCommand (/)
//
// Tiptap's suggestion plugin calls render().onStart / onUpdate / onKeyDown /
// onExit on a "renderer" object. This module provides:
//   1. A React component (<SuggestionList>) that renders the floating list
//   2. A `createSuggestionRenderer` factory that bridges the Tiptap
//      suggestion lifecycle to the React component via a portal.
// ---------------------------------------------------------------------------

export interface SuggestionItem {
  id?: string;
  title: string;
  description?: string;
  icon?: string;
  /** Opaque payload passed back to the command handler */
  [key: string]: unknown;
}

interface SuggestionListProps {
  items: SuggestionItem[];
  command: (item: SuggestionItem) => void;
}

export interface SuggestionListHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

export const SuggestionList = forwardRef<SuggestionListHandle, SuggestionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [items, command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="suggestion-popup rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-400 shadow-lg dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
          No results
        </div>
      );
    }

    return (
      <div className="suggestion-popup max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
        {items.map((item, index) => (
          <button
            key={item.id ?? item.title}
            type="button"
            className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${
              index === selectedIndex
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
            }`}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium">{item.title}</div>
              {item.description && (
                <div className="truncate text-xs text-gray-400">{item.description}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    );
  },
);

SuggestionList.displayName = 'SuggestionList';

// ---------------------------------------------------------------------------
// Factory: bridges Tiptap suggestion lifecycle to the React portal
// ---------------------------------------------------------------------------

/**
 * Creates a Tiptap suggestion `render()` config object that renders a
 * `<SuggestionList>` in a portal positioned relative to the cursor.
 *
 * Usage (inside an extension's suggestion config):
 *   suggestion: {
 *     ...otherConfig,
 *     render: createSuggestionRenderer,
 *   }
 */
export function createSuggestionRenderer() {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof import('react-dom/client').createRoot> | null = null;
  let listRef: SuggestionListHandle | null = null;

  return {
    onStart(props: any) {
      container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.zIndex = '50';
      document.body.appendChild(container);

      updatePosition(container, props.clientRect);
      renderList(container, props);
    },

    onUpdate(props: any) {
      if (!container) return;
      updatePosition(container, props.clientRect);
      renderList(container, props);
    },

    onKeyDown(props: any) {
      if (props.event.key === 'Escape') {
        cleanup();
        return true;
      }
      return listRef?.onKeyDown(props.event) ?? false;
    },

    onExit() {
      cleanup();
    },
  };

  function updatePosition(el: HTMLDivElement, clientRect: (() => DOMRect | null) | null) {
    const rect = typeof clientRect === 'function' ? clientRect() : clientRect;
    if (!rect) return;
    el.style.left = `${rect.left + window.scrollX}px`;
    el.style.top = `${rect.bottom + window.scrollY + 4}px`;
  }

  function renderList(el: HTMLDivElement, props: any) {
    // Use synchronous rendering via ReactDOM.render fallback or createRoot.
    // We lazy-import createRoot to avoid issues with React 18/19 differences.
    import('react-dom/client').then(({ createRoot }) => {
      if (!root) {
        root = createRoot(el);
      }
      root.render(
        <SuggestionList
          ref={(handle) => {
            listRef = handle;
          }}
          items={props.items ?? []}
          command={props.command}
        />,
      );
    });
  }

  function cleanup() {
    if (root) {
      root.unmount();
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
    listRef = null;
  }
}
