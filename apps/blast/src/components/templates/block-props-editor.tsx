/**
 * Property editor panel for the currently selected email block.
 * Renders controls specific to each block type.
 */

import type { EmailBlock } from './block-types';

interface Props {
  block: EmailBlock;
  onChange: (updated: EmailBlock) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

const input =
  'w-full px-2.5 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500';

const select =
  'w-full px-2.5 py-1.5 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-red-500';

function AlignPicker({ value, onChange }: { value: string; onChange: (v: 'left' | 'center' | 'right') => void }) {
  return (
    <div className="flex gap-1">
      {(['left', 'center', 'right'] as const).map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onChange(a)}
          className={`flex-1 px-2 py-1 text-xs rounded-md border transition-colors ${
            value === a
              ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-950 dark:border-red-700 dark:text-red-300'
              : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
        >
          {a.charAt(0).toUpperCase() + a.slice(1)}
        </button>
      ))}
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2 items-center">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-8 rounded border border-zinc-200 dark:border-zinc-700 cursor-pointer" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={input + ' flex-1'} />
    </div>
  );
}

export function BlockPropsEditor({ block, onChange }: Props) {
  // Helper to update nested props
  function set<T extends EmailBlock>(patch: Partial<T['props']>) {
    onChange({ ...block, props: { ...block.props, ...patch } } as EmailBlock);
  }

  switch (block.type) {
    case 'header':
      return (
        <div className="space-y-3">
          <Field label="Text">
            <input type="text" value={block.props.text} onChange={(e) => set({ text: e.target.value })} className={input} />
          </Field>
          <Field label="Level">
            <select value={block.props.level} onChange={(e) => set({ level: Number(e.target.value) as 1 | 2 | 3 })} className={select}>
              <option value={1}>H1 — Large</option>
              <option value={2}>H2 — Medium</option>
              <option value={3}>H3 — Small</option>
            </select>
          </Field>
          <Field label="Alignment">
            <AlignPicker value={block.props.align} onChange={(align) => set({ align })} />
          </Field>
          <Field label="Color">
            <ColorInput value={block.props.color} onChange={(color) => set({ color })} />
          </Field>
        </div>
      );

    case 'text':
      return (
        <div className="space-y-3">
          <Field label="Content (HTML)">
            <textarea value={block.props.html} onChange={(e) => set({ html: e.target.value })} rows={5} className={input + ' font-mono text-xs'} />
          </Field>
          <Field label="Font Size">
            <input type="number" min={10} max={32} value={block.props.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })} className={input} />
          </Field>
          <Field label="Alignment">
            <AlignPicker value={block.props.align} onChange={(align) => set({ align })} />
          </Field>
          <Field label="Color">
            <ColorInput value={block.props.color} onChange={(color) => set({ color })} />
          </Field>
        </div>
      );

    case 'image':
      return (
        <div className="space-y-3">
          <Field label="Image URL">
            <input type="url" value={block.props.src} onChange={(e) => set({ src: e.target.value })} className={input} placeholder="https://..." />
          </Field>
          <Field label="Alt Text">
            <input type="text" value={block.props.alt} onChange={(e) => set({ alt: e.target.value })} className={input} />
          </Field>
          <Field label="Link URL (optional)">
            <input type="url" value={block.props.href} onChange={(e) => set({ href: e.target.value })} className={input} placeholder="https://..." />
          </Field>
          <Field label="Width">
            <select value={block.props.width} onChange={(e) => set({ width: e.target.value as 'full' | '50%' | '75%' })} className={select}>
              <option value="full">Full width</option>
              <option value="75%">75%</option>
              <option value="50%">50%</option>
            </select>
          </Field>
          <Field label="Alignment">
            <AlignPicker value={block.props.align} onChange={(align) => set({ align })} />
          </Field>
          <Field label="Border Radius">
            <input type="number" min={0} max={32} value={block.props.borderRadius} onChange={(e) => set({ borderRadius: Number(e.target.value) })} className={input} />
          </Field>
        </div>
      );

    case 'button':
      return (
        <div className="space-y-3">
          <Field label="Button Text">
            <input type="text" value={block.props.text} onChange={(e) => set({ text: e.target.value })} className={input} />
          </Field>
          <Field label="Link URL">
            <input type="url" value={block.props.href} onChange={(e) => set({ href: e.target.value })} className={input} />
          </Field>
          <Field label="Background Color">
            <ColorInput value={block.props.bgColor} onChange={(bgColor) => set({ bgColor })} />
          </Field>
          <Field label="Text Color">
            <ColorInput value={block.props.textColor} onChange={(textColor) => set({ textColor })} />
          </Field>
          <Field label="Alignment">
            <AlignPicker value={block.props.align} onChange={(align) => set({ align })} />
          </Field>
          <Field label="Border Radius">
            <input type="number" min={0} max={32} value={block.props.borderRadius} onChange={(e) => set({ borderRadius: Number(e.target.value) })} className={input} />
          </Field>
          <Field label="Full Width">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={block.props.fullWidth} onChange={(e) => set({ fullWidth: e.target.checked })} className="rounded border-zinc-300" />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Stretch to container width</span>
            </label>
          </Field>
        </div>
      );

    case 'divider':
      return (
        <div className="space-y-3">
          <Field label="Color">
            <ColorInput value={block.props.color} onChange={(color) => set({ color })} />
          </Field>
          <Field label="Thickness (px)">
            <input type="number" min={1} max={8} value={block.props.thickness} onChange={(e) => set({ thickness: Number(e.target.value) })} className={input} />
          </Field>
          <Field label="Style">
            <select value={block.props.style} onChange={(e) => set({ style: e.target.value as 'solid' | 'dashed' | 'dotted' })} className={select}>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </Field>
          <Field label="Padding (px)">
            <input type="number" min={0} max={48} value={block.props.padding} onChange={(e) => set({ padding: Number(e.target.value) })} className={input} />
          </Field>
        </div>
      );

    case 'columns':
      return (
        <div className="space-y-3">
          <Field label="Columns">
            <select value={block.props.columns} onChange={(e) => {
              const n = Number(e.target.value) as 2 | 3;
              const contents = [...block.props.contents];
              while (contents.length < n) contents.push('<p>New column</p>');
              set({ columns: n, contents: contents.slice(0, n) });
            }} className={select}>
              <option value={2}>2 Columns</option>
              <option value={3}>3 Columns</option>
            </select>
          </Field>
          {block.props.contents.slice(0, block.props.columns).map((html, i) => (
            <Field key={i} label={`Column ${i + 1} (HTML)`}>
              <textarea
                value={html}
                onChange={(e) => {
                  const contents = [...block.props.contents];
                  contents[i] = e.target.value;
                  set({ contents });
                }}
                rows={3}
                className={input + ' font-mono text-xs'}
              />
            </Field>
          ))}
        </div>
      );

    case 'social':
      return (
        <div className="space-y-3">
          <Field label="Alignment">
            <AlignPicker value={block.props.align} onChange={(align) => set({ align })} />
          </Field>
          {block.props.links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={link.platform}
                onChange={(e) => {
                  const links = [...block.props.links];
                  links[i] = { platform: e.target.value, url: link.url };
                  set({ links });
                }}
                placeholder="Platform"
                className={input + ' w-28'}
              />
              <input
                type="url"
                value={link.url}
                onChange={(e) => {
                  const links = [...block.props.links];
                  links[i] = { platform: link.platform, url: e.target.value };
                  set({ links });
                }}
                placeholder="https://..."
                className={input + ' flex-1'}
              />
              <button
                type="button"
                onClick={() => {
                  const links = block.props.links.filter((_, j) => j !== i);
                  set({ links });
                }}
                className="px-2 text-zinc-400 hover:text-red-500 transition-colors"
              >
                &times;
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set({ links: [...block.props.links, { platform: '', url: '' }] })}
            className="text-xs text-red-600 hover:text-red-700 font-medium"
          >
            + Add link
          </button>
        </div>
      );

    case 'spacer':
      return (
        <div className="space-y-3">
          <Field label="Height (px)">
            <input type="number" min={4} max={120} value={block.props.height} onChange={(e) => set({ height: Number(e.target.value) })} className={input} />
          </Field>
        </div>
      );
  }
}
