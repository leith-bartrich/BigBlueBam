import { Node, mergeAttributes } from '@tiptap/core';

// ---------------------------------------------------------------------------
// TaskEmbed extension for Brief
//
// Embeds a Bam task reference as an inline-block node. Displays task key +
// title with a link to the task detail page. The node stores task_id, key,
// and title as attributes so rendering works without a network call.
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    taskEmbed: {
      insertTaskEmbed: (attrs: { taskId: string; taskKey: string; title: string }) => ReturnType;
    };
  }
}

export const TaskEmbed = Node.create({
  name: 'taskEmbed',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      taskId: { default: null },
      taskKey: { default: null },
      title: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-task-embed]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-task-embed': '',
        class: 'task-embed',
        title: HTMLAttributes.title,
      }),
      `[${HTMLAttributes.taskKey}] ${HTMLAttributes.title}`,
    ];
  },

  addCommands() {
    return {
      insertTaskEmbed:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});

export default TaskEmbed;
