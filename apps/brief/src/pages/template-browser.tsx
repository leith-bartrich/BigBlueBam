import { Loader2, LayoutTemplate, FileText } from 'lucide-react';
import { useTemplates } from '@/hooks/use-templates';

interface TemplateBrowserPageProps {
  onNavigate: (path: string) => void;
}

export function TemplateBrowserPage({ onNavigate }: TemplateBrowserPageProps) {
  const { data: templates, isLoading } = useTemplates();

  const handleSelectTemplate = (templateId: string) => {
    // Navigate to the new document editor; the editor will load the template
    // We pass the template_id via the route. For simplicity, navigate to /new
    // and store the selection. Since we don't have query params in our simple router,
    // we store the selected template in sessionStorage and pick it up in the editor.
    try {
      sessionStorage.setItem('brief_selected_template', templateId);
    } catch {
      // ignore
    }
    onNavigate('/new');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
          <LayoutTemplate className="h-6 w-6 text-primary-500" />
          Templates
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Start a new document from a pre-built template.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      ) : !templates || templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <LayoutTemplate className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mb-3" />
          <p className="text-zinc-500 dark:text-zinc-400">No templates available yet.</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            Templates can be created by administrators.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleSelectTemplate(template.id)}
              className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-5 text-left hover:border-primary-300 hover:bg-primary-50/30 dark:hover:border-primary-700 dark:hover:bg-primary-900/10 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-lg">
                  {template.icon_emoji ?? <FileText className="h-5 w-5 text-zinc-400" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {template.name}
                  </h3>
                  {template.category && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {template.category}
                    </span>
                  )}
                </div>
              </div>
              {template.description && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  {template.description}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
