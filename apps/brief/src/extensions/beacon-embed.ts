import { Node, mergeAttributes } from '@tiptap/core';

// ---------------------------------------------------------------------------
// BeaconEmbed extension for Brief
//
// Embeds a Beacon knowledge base entry reference as an inline-block node.
// Stores beacon_entry_id and title. Renders as a linked pill with a book
// icon so users can quickly navigate to the Beacon article.
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    beaconEmbed: {
      insertBeaconEmbed: (attrs: { entryId: string; title: string }) => ReturnType;
    };
  }
}

export const BeaconEmbed = Node.create({
  name: 'beaconEmbed',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      entryId: { default: null },
      title: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-beacon-embed]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-beacon-embed': '',
        class: 'beacon-embed',
      }),
      `\u{1F4D6} ${HTMLAttributes.title}`,
    ];
  },

  addCommands() {
    return {
      insertBeaconEmbed:
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

export default BeaconEmbed;
