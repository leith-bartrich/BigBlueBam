import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

interface BriefEditorProps {
  content: string;
  onUpdate: (html: string) => void;
  editable?: boolean;
  onEditorReady?: (editor: Editor) => void;
}

export function useBriefEditor({
  content,
  onUpdate,
  editable = true,
  key,
}: {
  content: string;
  onUpdate: (html: string) => void;
  editable?: boolean;
  /** Change this value to force the editor to re-create with new content */
  key?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Link.configure({
        autolink: true,
        openOnClick: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Highlight,
      Typography,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      HorizontalRule,
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: 'prose-editor focus:outline-none',
      },
    },
    onUpdate: ({ editor: e }) => {
      onUpdate(e.getHTML());
    },
  });

  return editor;
}

interface BriefEditorContentProps {
  editor: Editor | null;
}

export function BriefEditorContent({ editor }: BriefEditorContentProps) {
  if (!editor) return null;

  return (
    <div className="brief-editor flex-1 overflow-auto">
      <EditorContent editor={editor} className="h-full" />
    </div>
  );
}

export type { BriefEditorProps };
