import { Extension } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';

// ---------------------------------------------------------------------------
// SlashCommand extension for Brief
//
// Triggers a command palette popup when the user types '/' at the start of
// a line or after whitespace. The popup shows available block types (heading,
// callout, code block, table, task list, etc.) and inserts the selected one.
//
// The actual rendering of the suggestion popup is handled by the caller via
// the `suggestion.render` option (a React component provided at config time).
// This module supplies the Tiptap plumbing and a default command list.
// ---------------------------------------------------------------------------

export interface SlashCommandItem {
  title: string;
  description: string;
  icon?: string;
  command: (props: { editor: any; range: any }) => void;
}

/**
 * Default set of slash commands available in the Brief editor.
 * Callers can override by passing a custom `items` function.
 */
export function defaultSlashCommands(): SlashCommandItem[] {
  return [
    {
      title: 'Heading 1',
      description: 'Large section heading',
      icon: 'heading-1',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
      },
    },
    {
      title: 'Heading 2',
      description: 'Medium section heading',
      icon: 'heading-2',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
      },
    },
    {
      title: 'Heading 3',
      description: 'Small section heading',
      icon: 'heading-3',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
      },
    },
    {
      title: 'Bullet List',
      description: 'Unordered list',
      icon: 'list',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: 'Numbered List',
      description: 'Ordered list',
      icon: 'list-ordered',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: 'Task List',
      description: 'Checklist with checkboxes',
      icon: 'check-square',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: 'Code Block',
      description: 'Fenced code with syntax highlighting',
      icon: 'code',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: 'Blockquote',
      description: 'Indented quote block',
      icon: 'quote',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: 'Horizontal Rule',
      description: 'Divider line',
      icon: 'minus',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: 'Table',
      description: 'Insert a table',
      icon: 'table',
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
    {
      title: 'Image',
      description: 'Insert an image by URL',
      icon: 'image',
      command: ({ editor, range }) => {
        const url = window.prompt('Image URL');
        if (url) {
          editor.chain().focus().deleteRange(range).setImage({ src: url }).run();
        }
      },
    },
  ];
}

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        items: ({ query }: { query: string }) => {
          const commands = defaultSlashCommands();
          if (!query) return commands;
          const lower = query.toLowerCase();
          return commands.filter(
            (item) =>
              item.title.toLowerCase().includes(lower) ||
              item.description.toLowerCase().includes(lower),
          );
        },
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      } as Partial<SuggestionOptions>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export default SlashCommand;
