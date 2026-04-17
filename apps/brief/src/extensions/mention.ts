import { Mention as TiptapMention } from '@tiptap/extension-mention';

// ---------------------------------------------------------------------------
// Mention extension for Brief
//
// Renders @user mentions inline. When a user types '@' the suggestion plugin
// (provided by the caller via `suggestion` config) displays a popup with
// matching users. Selected mentions are stored as `<span>` nodes with a
// data-mention-id attribute so the API can extract them for notifications.
// ---------------------------------------------------------------------------

export const Mention = TiptapMention.configure({
  HTMLAttributes: {
    class: 'mention',
  },
  renderLabel({ node }) {
    return `@${node.attrs.label ?? node.attrs.id ?? ''}`;
  },
  suggestion: {
    char: '@',
    allowSpaces: false,
    // The actual items + render functions are provided at the call site
    // via `Mention.configure({ suggestion: { ... } })`. This default
    // returns an empty list so the extension is safe to use without config.
    items: async () => [],
  },
});

export default Mention;
