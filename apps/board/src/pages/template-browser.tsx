import { useState } from 'react';
import { LayoutTemplate, Loader2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/common/badge';
import { Button } from '@/components/common/button';
import { useTemplates, useInstantiateTemplate, type TemplateCategory } from '@/hooks/use-templates';

interface TemplateBrowserPageProps {
  onNavigate: (path: string) => void;
}

const categories: { value: TemplateCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'retro', label: 'Retro' },
  { value: 'brainstorm', label: 'Brainstorm' },
  { value: 'architecture', label: 'Architecture' },
  { value: 'planning', label: 'Planning' },
  { value: 'general', label: 'General' },
];

const categoryBadgeVariant: Record<TemplateCategory, 'primary' | 'success' | 'warning' | 'info' | 'default'> = {
  retro: 'warning',
  brainstorm: 'success',
  architecture: 'info',
  planning: 'primary',
  general: 'default',
};

export function TemplateBrowserPage({ onNavigate }: TemplateBrowserPageProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'all'>('all');

  const { data, isLoading } = useTemplates(activeCategory === 'all' ? undefined : activeCategory);
  const templates = data?.data ?? [];

  const instantiate = useInstantiateTemplate();

  const handleUseTemplate = (templateId: string) => {
    instantiate.mutate(
      { templateId },
      {
        onSuccess: (res) => {
          onNavigate(`/${res.data.id}`);
        },
      },
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Templates</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Start from a pre-built template to get going faster
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeCategory === cat.value
                ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-4">
            <LayoutTemplate className="h-8 w-8 text-zinc-400" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            No templates available
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm">
            {activeCategory !== 'all'
              ? 'No templates found in this category. Try selecting a different one.'
              : 'Templates will appear here once they are created by your team or organization.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className={cn(
                'group flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800',
                'bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-all',
                'hover:border-zinc-300 dark:hover:border-zinc-700',
              )}
            >
              {/* Thumbnail */}
              <div className="h-36 rounded-t-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                {template.thumbnail_url ? (
                  <img
                    src={template.thumbnail_url}
                    alt={template.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <LayoutTemplate className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="flex flex-col gap-2 p-4 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {template.name}
                  </h3>
                  <Badge variant={categoryBadgeVariant[template.category]} className="shrink-0 text-[10px]">
                    {template.category}
                  </Badge>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 flex-1">
                  {template.description}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-zinc-400">
                    {template.element_count} element{template.element_count !== 1 ? 's' : ''}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleUseTemplate(template.id)}
                    loading={instantiate.isPending}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Use
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
