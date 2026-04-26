import { useState } from 'react';
import { LayoutGrid, Loader2, ArrowLeft } from 'lucide-react';
import { useCreateBoard } from '@/hooks/use-boards';
import { useTemplates } from '@/hooks/use-templates';
import { useProjectStore } from '@/stores/project.store';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { IconPicker } from '@/components/common/icon-picker';
import { cn } from '@/lib/utils';

interface BoardNewPageProps {
  onNavigate: (path: string) => void;
}

export function BoardNewPage({ onNavigate }: BoardNewPageProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const createBoard = useCreateBoard();
  const { data: templateData, isLoading: templatesLoading } = useTemplates();
  const templates = templateData?.data ?? [];

  const [error, setError] = useState<string | null>(null);

  const handleCreate = () => {
    setError(null);
    const boardName = name.trim() || 'Untitled Board';
    // Derive the icon for the new board: use the user's explicit pick
    // first, else fall back to the selected template's icon so the
    // All Boards view isn't empty.
    const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
    const effectiveIcon = icon ?? selectedTemplate?.icon ?? null;
    createBoard.mutate(
      {
        name: boardName,
        icon: effectiveIcon,
        project_id: activeProjectId ?? undefined,
        template_id: selectedTemplateId ?? undefined,
      },
      {
        onSuccess: (res) => {
          onNavigate(`/${res.data.id}`);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Failed to create board');
        },
      },
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Sticky header — keeps the name field, icon picker, and the
          Create/Cancel buttons visible at the top of the page even when
          the templates grid is taller than the viewport. Previously the
          actions sat at the bottom and were hidden below the fold once
          enough templates were seeded, which made "create" feel buried. */}
      <div className="sticky top-0 z-10 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => onNavigate('/')}
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Create New Board</h1>
            <p className="text-sm text-zinc-500">Choose a template and give your board a name</p>
          </div>
        </div>

        {/* Icon + name + actions on a single row so all primary controls are
            visible above any template grid scroll. The name input is
            constrained to a sensible max-width rather than spanning the
            entire form, which made it feel uncomfortably wide on big
            screens. */}
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Icon
            </label>
            <IconPicker value={icon} onChange={setIcon} tone="blue" />
          </div>
          <div className="flex-1 min-w-[14rem] max-w-md">
            <Input
              label="Board name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Untitled Board"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-2 ml-auto pb-0.5">
            <Button variant="ghost" onClick={() => onNavigate('/')}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={createBoard.isPending}>
              Create Board
            </Button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">

      {/* Template selector */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Choose a template</h2>

        {templatesLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Blank board option (always first) */}
            <button
              onClick={() => setSelectedTemplateId(null)}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                selectedTemplateId === null
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/30'
                  : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600',
              )}
            >
              <div className="flex items-center justify-center h-10 w-10 rounded-lg shrink-0 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Blank Board</p>
                <p className="text-xs text-zinc-500 mt-0.5">Start with an empty canvas</p>
              </div>
            </button>

            {/* DB-backed templates */}
            {templates.map((template) => {
              const isSelected = selectedTemplateId === template.id;
              return (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                    isSelected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/30'
                      : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600',
                  )}
                >
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-lg">
                    {template.icon || <LayoutGrid className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{template.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{template.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      </div>
    </div>
  );
}
