import { Node, mergeAttributes } from '@tiptap/core';

// ---------------------------------------------------------------------------
// ChannelLink extension for Brief
//
// Inline node that renders a Banter channel reference. When a user types
// '#' followed by a channel name, the suggestion plugin (wired externally)
// displays matching channels. Selected channels render as clickable pills
// that navigate to the Banter channel view.
//
// Attributes stored: channelId, channelName.
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    channelLink: {
      insertChannelLink: (attrs: { channelId: string; channelName: string }) => ReturnType;
    };
  }
}

export const ChannelLink = Node.create({
  name: 'channelLink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      channelId: { default: null },
      channelName: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-channel-link]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-channel-link': '',
        class: 'channel-link',
        href: `/banter/channels/${HTMLAttributes.channelId}`,
        target: '_blank',
        rel: 'noopener noreferrer',
      }),
      `#${HTMLAttributes.channelName}`,
    ];
  },

  addCommands() {
    return {
      insertChannelLink:
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

export default ChannelLink;
