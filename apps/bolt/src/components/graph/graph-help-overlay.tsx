const kbdClass =
  'px-1.5 py-0.5 text-xs font-mono bg-zinc-100 dark:bg-zinc-700 rounded border border-zinc-200 dark:border-zinc-600';

const shortcuts = [
  { keys: ['Delete', 'Backspace'], desc: 'Remove selected node' },
  { keys: ['Escape'], desc: 'Deselect all' },
  { keys: ['?'], desc: 'Toggle this help' },
  { keys: ['Ctrl+A'], desc: 'Select all nodes' },
  { keys: ['Scroll'], desc: 'Zoom in/out' },
  { keys: ['Drag background'], desc: 'Pan' },
] as const;

export function GraphHelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Keyboard Shortcuts
        </h3>
        <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
          {shortcuts.map((s) => (
            <li key={s.desc} className="flex items-baseline gap-2">
              <span>
                {s.keys.map((k, i) => (
                  <span key={k}>
                    {i > 0 && <span className="mx-1 text-zinc-400">/</span>}
                    <kbd className={kbdClass}>{k}</kbd>
                  </span>
                ))}
              </span>
              <span className="text-zinc-400">—</span>
              <span>{s.desc}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Close (Esc)
        </button>
      </div>
    </div>
  );
}
