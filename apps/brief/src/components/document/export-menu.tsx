import { useState, useRef, useEffect } from 'react';
import { Download, FileText, Code2 } from 'lucide-react';
import { Button } from '@/components/common/button';

interface ExportMenuProps {
  documentId: string;
  slug: string;
}

export function ExportMenu({ documentId, slug: _slug }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const baseUrl = '/brief/api/v1';

  const handleExport = (format: 'markdown' | 'html') => {
    const url = `${baseUrl}/documents/${documentId}/export/${format}`;
    window.open(url, '_blank');
    setOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>
        <Download className="h-4 w-4" />
        Export
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900 z-50">
          <div className="p-1">
            <button
              onClick={() => handleExport('markdown')}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            >
              <FileText className="h-4 w-4 text-zinc-400" />
              Markdown (.md)
            </button>
            <button
              onClick={() => handleExport('html')}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            >
              <Code2 className="h-4 w-4 text-zinc-400" />
              HTML (.html)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
