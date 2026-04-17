import { BubbleMenu as TiptapBubbleMenu } from '@tiptap/react';

// ---------------------------------------------------------------------------
// BubbleMenu configuration for Brief
//
// Re-exports the Tiptap BubbleMenu component with default settings for
// the Brief editor. The BubbleMenu appears when text is selected, offering
// quick formatting options (bold, italic, link, highlight, etc.).
//
// This is a configuration module rather than a Tiptap extension. The actual
// BubbleMenu extension is built into @tiptap/extension-bubble-menu and
// activated by rendering the <BubbleMenu> React component alongside the
// <EditorContent>. This module provides shared config constants.
// ---------------------------------------------------------------------------

/**
 * Default BubbleMenu configuration matching Brief's UX conventions.
 */
export const bubbleMenuConfig = {
  /** Delay before the menu appears after selection (ms) */
  showDelay: 150,
  /** Delay before the menu hides after deselection (ms) */
  hideDelay: 100,
  /** Tippy.js placement for the floating menu */
  placement: 'top' as const,
  /** Do not show bubble menu inside code blocks or when nothing is selected */
  shouldShow: ({ editor, state }: { editor: any; state: any }) => {
    const { selection } = state;
    const { empty } = selection;
    // Do not show on empty selections
    if (empty) return false;
    // Do not show inside code blocks
    if (editor.isActive('codeBlock')) return false;
    return true;
  },
};

/** Re-export for convenience so consumers do not need a separate import */
export { TiptapBubbleMenu as BubbleMenu };

export default bubbleMenuConfig;
