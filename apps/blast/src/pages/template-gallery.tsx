import { useState } from 'react';
import { Plus, Search, FileText, Copy, Trash2 } from 'lucide-react';
import { useTemplates, useDeleteTemplate, useDuplicateTemplate } from '@/hooks/use-templates';
import { formatRelativeTime } from '@/lib/utils';

interface TemplateGalleryPageProps {
  onNavigate: (path: string) => void;
}

export function TemplateGalleryPage({ onNavigate }: TemplateGalleryPageProps) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useTemplates({ search: search || undefined });
  const deleteTemplate = useDeleteTemplate();
  const duplicateTemplate = useDuplicateTemplate();
  const templates = data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Templates</h1>
          <p className="text-sm text-zinc-500 mt-1">Reusable email templates for your campaigns</p>
        </div>
        <button
          onClick={() => onNavigate('/templates/new')}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-zinc-500">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">No templates yet</h3>
          <p className="text-sm text-zinc-500 mt-1">Create your first email template.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="group border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onNavigate(`/templates/${template.id}/edit`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{template.name}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">{template.subject_template}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 ml-2">
                  v{template.version}
                </span>
              </div>

              {template.description && (
                <p className="text-sm text-zinc-500 line-clamp-2 mb-3">{template.description}</p>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="text-xs text-zinc-400">{formatRelativeTime(template.updated_at)}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => duplicateTemplate.mutate(template.id)}
                    className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600"
                    title="Duplicate"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this template?')) deleteTemplate.mutate(template.id);
                    }}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
