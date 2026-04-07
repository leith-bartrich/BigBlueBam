import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  editor: Editor | null;
}

function extractHeadings(editor: Editor): TocItem[] {
  const headings: TocItem[] = [];
  const doc = editor.getJSON();

  if (!doc.content) return headings;

  let index = 0;
  for (const node of doc.content) {
    if (node.type === 'heading' && node.attrs?.level && node.content) {
      const text = node.content
        .map((c) => c.text ?? '')
        .join('');
      if (text.trim()) {
        headings.push({
          id: `heading-${index}`,
          text: text.trim(),
          level: node.attrs.level as number,
        });
        index++;
      }
    }
  }

  return headings;
}

export function TableOfContents({ editor }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<TocItem[]>([]);

  useEffect(() => {
    if (!editor) return;

    const updateHeadings = () => {
      setHeadings(extractHeadings(editor));
    };

    // Initial extraction
    updateHeadings();

    // Listen for content changes
    editor.on('update', updateHeadings);

    return () => {
      editor.off('update', updateHeadings);
    };
  }, [editor]);

  const scrollToHeading = (index: number) => {
    if (!editor) return;

    const doc = editor.state.doc;
    let headingIndex = 0;

    doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        if (headingIndex === index) {
          // Scroll the editor to this position
          const dom = editor.view.domAtPos(pos + 1);
          if (dom.node) {
            const element =
              dom.node instanceof HTMLElement
                ? dom.node
                : dom.node.parentElement;
            element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          return false;
        }
        headingIndex++;
      }
    });
  };

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-3.5 w-3.5 text-zinc-400" />
        <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          Table of Contents
        </h3>
      </div>

      {headings.length === 0 ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
          Add headings to see a table of contents
        </p>
      ) : (
        <nav className="space-y-0.5">
          {headings.map((heading, i) => {
            const indent = (heading.level - 1) * 12;
            return (
              <button
                key={`${heading.id}-${heading.text}`}
                type="button"
                onClick={() => scrollToHeading(i)}
                style={{ paddingLeft: `${indent}px` }}
                className={cn(
                  'block w-full text-left text-xs py-1 pr-2 rounded transition-colors truncate',
                  'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                  heading.level === 1 && 'font-medium',
                )}
              >
                {heading.text}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
