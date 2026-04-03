import * as RadixDialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'motion/react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcutGroups = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['N'], description: 'Create new task' },
      { keys: ['S'], description: 'Focus search' },
      { keys: ['/'], description: 'Focus search' },
      { keys: ['F'], description: 'Toggle filter panel' },
      { keys: ['Escape'], description: 'Close dialog/drawer' },
      { keys: ['?'], description: 'Toggle this overlay' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Open command palette' },
    ],
  },
];

function ShortcutKey({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded border border-zinc-300 bg-zinc-100 text-xs font-mono font-medium text-zinc-700 dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-300">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsOverlay({ open, onOpenChange }: KeyboardShortcutsOverlayProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 bg-black/40 z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content asChild>
              <motion.div
                className="fixed top-1/2 left-1/2 z-50 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900 dark:border dark:border-zinc-800"
                initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
                animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-50%' }}
                transition={{ duration: 0.15 }}
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Keyboard className="h-5 w-5 text-zinc-500" />
                    <RadixDialog.Title className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      Keyboard Shortcuts
                    </RadixDialog.Title>
                  </div>
                  <RadixDialog.Close className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <X className="h-4 w-4" />
                  </RadixDialog.Close>
                </div>
                <RadixDialog.Description className="sr-only">
                  Available keyboard shortcuts
                </RadixDialog.Description>

                <div className="space-y-5">
                  {shortcutGroups.map((group) => (
                    <div key={group.title}>
                      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                        {group.title}
                      </h3>
                      <div className="space-y-1.5">
                        {group.shortcuts.map((shortcut) => (
                          <div
                            key={shortcut.description}
                            className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          >
                            <span className="text-sm text-zinc-700 dark:text-zinc-300">
                              {shortcut.description}
                            </span>
                            <div className="flex items-center gap-1">
                              {shortcut.keys.map((key, i) => (
                                <span key={i} className="flex items-center gap-1">
                                  {i > 0 && <span className="text-xs text-zinc-400">+</span>}
                                  <ShortcutKey>{key}</ShortcutKey>
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}
