import { useEffect, useCallback } from 'react';

export interface ShortcutMap {
  [key: string]: () => void;
}

function isInputElement(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tagName = el.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
  if (el.isContentEditable) return true;
  return false;
}

function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts[parts.length - 1]!;
  const needsMeta = parts.includes('cmd') || parts.includes('meta');
  const needsCtrl = parts.includes('ctrl');
  const needsShift = parts.includes('shift');
  const needsAlt = parts.includes('alt');

  const eventKey = event.key.toLowerCase();

  if (needsMeta && !event.metaKey) return false;
  if (needsCtrl && !event.ctrlKey) return false;
  if (needsShift && !event.shiftKey) return false;
  if (needsAlt && !event.altKey) return false;

  // For shortcuts without modifiers, skip if any modifier is pressed (except shift for ?)
  if (!needsMeta && !needsCtrl && !needsAlt && !needsShift) {
    if (event.metaKey || event.ctrlKey || event.altKey) return false;
  }

  if (key === 'escape') return eventKey === 'escape';
  if (key === '/') return eventKey === '/';
  if (key === '?') return eventKey === '?' || (event.shiftKey && eventKey === '/');

  return eventKey === key;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // For non-modifier shortcuts, ignore when focused in input elements
      for (const [shortcut, handler] of Object.entries(shortcuts)) {
        if (matchesShortcut(event, shortcut)) {
          const hasModifier = shortcut.toLowerCase().includes('cmd') ||
            shortcut.toLowerCase().includes('ctrl') ||
            shortcut.toLowerCase().includes('meta');

          // Allow modifier shortcuts even in inputs (e.g., Cmd+K)
          // But block simple key shortcuts (n, s, f, ?) when in inputs
          if (!hasModifier && shortcut.toLowerCase() !== 'escape' && isInputElement(event.target)) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          handler();
          return;
        }
      }
    },
    [shortcuts, enabled],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
