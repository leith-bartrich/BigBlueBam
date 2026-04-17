import { Node, mergeAttributes } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Callout extension for Brief
//
// A block-level container for tips, warnings, info, and success callouts.
// Renders as a styled <div> with a data-callout-type attribute. Users
// toggle the callout type through a toolbar button or the slash command.
//
// Usage:
//   editor.commands.setCallout({ type: 'info' })
//   editor.commands.toggleCallout({ type: 'warning' })
// ---------------------------------------------------------------------------

export type CalloutType = 'info' | 'warning' | 'tip' | 'success';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { type?: CalloutType }) => ReturnType;
      toggleCallout: (attrs?: { type?: CalloutType }) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      type: {
        default: 'info' as CalloutType,
        parseHTML: (element) => element.getAttribute('data-callout-type') ?? 'info',
        renderHTML: (attributes) => ({ 'data-callout-type': attributes.type }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-callout': '',
        class: `callout callout-${HTMLAttributes['data-callout-type'] ?? 'info'}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs);
        },
      toggleCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, attrs);
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Mod+Shift+C toggles callout
      'Mod-Shift-c': () => this.editor.commands.toggleCallout(),
    };
  },
});

export default Callout;
