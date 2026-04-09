import { useState } from 'react';
import { LayoutGrid, FileText, Presentation, Kanban, Network, ArrowLeft } from 'lucide-react';
import { useCreateBoard } from '@/hooks/use-boards';
import { useProjectStore } from '@/stores/project.store';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { cn } from '@/lib/utils';

interface BoardNewPageProps {
  onNavigate: (path: string) => void;
}

const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank Board',
    description: 'Start with an empty canvas',
    icon: LayoutGrid,
    color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Sticky notes and frames for ideation',
    icon: FileText,
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  {
    id: 'presentation',
    name: 'Presentation',
    description: 'Slide-like frames for walkthroughs',
    icon: Presentation,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  {
    id: 'kanban',
    name: 'Kanban Board',
    description: 'Visual task tracking with columns',
    icon: Kanban,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  {
    id: 'mindmap',
    name: 'Mind Map',
    description: 'Radial diagram for concept mapping',
    icon: Network,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
];

export function BoardNewPage({ onNavigate }: BoardNewPageProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const [name, setName] = useState('');
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const createBoard = useCreateBoard();

  const [error, setError] = useState<string | null>(null);

  const handleCreate = () => {
    setError(null);
    const boardName = name.trim() || 'Untitled Board';
    createBoard.mutate(
      {
        name: boardName,
        project_id: activeProjectId ?? undefined,
        // template_id is for future DB-backed templates; the local presets just set a name hint
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
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => onNavigate('/')}
          className="flex items-center justify-center h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Create New Board</h1>
          <p className="text-sm text-zinc-500">Choose a template and give your board a name</p>
        </div>
      </div>

      {/* Board name */}
      <div className="mb-8">
        <Input
          label="Board name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled Board"
          autoFocus
        />
      </div>

      {/* Template selector */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Choose a template</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map((template) => {
            const Icon = template.icon;
            const isSelected = selectedTemplate === template.id;
            return (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                  isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/30'
                    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600',
                )}
              >
                <div className={cn('flex items-center justify-center h-10 w-10 rounded-lg shrink-0', template.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{template.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{template.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleCreate} loading={createBoard.isPending}>
          Create Board
        </Button>
        <Button variant="ghost" onClick={() => onNavigate('/')}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
