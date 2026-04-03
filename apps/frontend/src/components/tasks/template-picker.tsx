import { useQuery } from '@tanstack/react-query';
import { Loader2, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/common/button';
import { api } from '@/lib/api';

interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  priority: string;
  story_points: number | null;
  label_ids: string[];
}

interface TemplatePickerProps {
  projectId: string;
  onSelectTemplate: (template: TaskTemplate) => void;
  onClose: () => void;
}

export function TemplatePicker({ projectId, onSelectTemplate, onClose }: TemplatePickerProps) {
  const { data: templatesRes, isLoading } = useQuery({
    queryKey: ['task-templates', projectId],
    queryFn: () =>
      api.get<{ data: TaskTemplate[] }>(`/projects/${projectId}/task-templates`),
    enabled: !!projectId,
  });
  const templates = templatesRes?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4" />
          Task Templates
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-6">
          <FileText className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">No templates yet</p>
          <p className="text-xs text-zinc-400 mt-1">Create templates from the project settings.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(template)}
              className="w-full text-left p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {template.name}
              </p>
              {template.description && (
                <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                  {template.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                {template.priority && (
                  <span className="text-xs text-zinc-400 capitalize">
                    {template.priority}
                  </span>
                )}
                {template.story_points != null && (
                  <span className="text-xs text-zinc-400">
                    {template.story_points} pts
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
