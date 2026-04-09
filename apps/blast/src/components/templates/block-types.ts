/**
 * Email template block definitions.
 *
 * Each block type describes a self-contained section of an email.
 * The visual builder composes blocks top-to-bottom; `blocksToHtml`
 * renders the final email-safe HTML with inline styles.
 */

export type BlockType =
  | 'header'
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'columns'
  | 'social'
  | 'spacer';

export interface HeaderBlock {
  type: 'header';
  id: string;
  props: {
    text: string;
    level: 1 | 2 | 3;
    align: 'left' | 'center' | 'right';
    color: string;
  };
}

export interface TextBlock {
  type: 'text';
  id: string;
  props: {
    html: string; // rich text content
    align: 'left' | 'center' | 'right';
    color: string;
    fontSize: number;
  };
}

export interface ImageBlock {
  type: 'image';
  id: string;
  props: {
    src: string;
    alt: string;
    href: string;
    width: 'full' | '50%' | '75%';
    align: 'left' | 'center' | 'right';
    borderRadius: number;
  };
}

export interface ButtonBlock {
  type: 'button';
  id: string;
  props: {
    text: string;
    href: string;
    bgColor: string;
    textColor: string;
    align: 'left' | 'center' | 'right';
    borderRadius: number;
    fullWidth: boolean;
  };
}

export interface DividerBlock {
  type: 'divider';
  id: string;
  props: {
    color: string;
    thickness: number;
    style: 'solid' | 'dashed' | 'dotted';
    padding: number;
  };
}

export interface ColumnsBlock {
  type: 'columns';
  id: string;
  props: {
    columns: 2 | 3;
    contents: string[]; // HTML content per column
  };
}

export interface SocialBlock {
  type: 'social';
  id: string;
  props: {
    align: 'left' | 'center' | 'right';
    links: { platform: string; url: string }[];
  };
}

export interface SpacerBlock {
  type: 'spacer';
  id: string;
  props: {
    height: number;
  };
}

export type EmailBlock =
  | HeaderBlock
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | ColumnsBlock
  | SocialBlock
  | SpacerBlock;

/* ------------------------------------------------------------------
 * Defaults for newly created blocks
 * ------------------------------------------------------------------ */

let _counter = 0;
function uid() {
  return `block_${Date.now()}_${++_counter}`;
}

export function createBlock(type: BlockType): EmailBlock {
  const id = uid();
  switch (type) {
    case 'header':
      return { type, id, props: { text: 'Heading', level: 1, align: 'left', color: '#111827' } };
    case 'text':
      return {
        type,
        id,
        props: { html: '<p>Write your content here...</p>', align: 'left', color: '#374151', fontSize: 16 },
      };
    case 'image':
      return {
        type,
        id,
        props: {
          src: 'https://placehold.co/600x200/e2e8f0/64748b?text=Your+Image',
          alt: '',
          href: '',
          width: 'full',
          align: 'center',
          borderRadius: 8,
        },
      };
    case 'button':
      return {
        type,
        id,
        props: {
          text: 'Click Here',
          href: 'https://example.com',
          bgColor: '#dc2626',
          textColor: '#ffffff',
          align: 'center',
          borderRadius: 6,
          fullWidth: false,
        },
      };
    case 'divider':
      return { type, id, props: { color: '#e5e7eb', thickness: 1, style: 'solid', padding: 16 } };
    case 'columns':
      return {
        type,
        id,
        props: { columns: 2, contents: ['<p>Column 1</p>', '<p>Column 2</p>'] },
      };
    case 'social':
      return {
        type,
        id,
        props: {
          align: 'center',
          links: [
            { platform: 'twitter', url: 'https://x.com' },
            { platform: 'linkedin', url: 'https://linkedin.com' },
          ],
        },
      };
    case 'spacer':
      return { type, id, props: { height: 24 } };
  }
}

/* ------------------------------------------------------------------
 * Block palette — items shown in the left sidebar
 * ------------------------------------------------------------------ */

export interface PaletteItem {
  type: BlockType;
  label: string;
  description: string;
}

export const PALETTE: PaletteItem[] = [
  { type: 'header', label: 'Heading', description: 'Title or section heading' },
  { type: 'text', label: 'Text', description: 'Rich text paragraph' },
  { type: 'image', label: 'Image', description: 'Image with optional link' },
  { type: 'button', label: 'Button', description: 'Call-to-action button' },
  { type: 'divider', label: 'Divider', description: 'Horizontal line' },
  { type: 'columns', label: 'Columns', description: '2 or 3 column layout' },
  { type: 'social', label: 'Social', description: 'Social media links' },
  { type: 'spacer', label: 'Spacer', description: 'Vertical whitespace' },
];
