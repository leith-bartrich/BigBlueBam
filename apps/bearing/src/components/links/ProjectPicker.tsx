import { useState } from 'react';
import { Search, Check, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { bbbGet } from '@/lib/bbb-api';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
}

interface ProjectListResponse {
  data: Project[];
}

interface ProjectPickerProps {
  onSelect: (projectId: string, projectName: string) => void;
  selectedId: string;
}

export function ProjectPicker({ onSelect, selectedId }: ProjectPickerProps) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['bbb', 'projects', 'list'],
    queryFn: () => bbbGet<ProjectListResponse>('/projects'),
    staleTime: 60_000,
  });

  const projects = data?.data ?? [];

  const filtered = search.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      )
    : projects;

  return (
    <div>
      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2 block">Select Project</label>
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
        />
      </div>

      <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-4 text-center text-sm text-zinc-400">No projects found</div>
        ) : (
          filtered.map((project) => {
            const isSelected = selectedId === project.id;
            return (
              <button
                key={project.id}
                onClick={() => onSelect(project.id, project.name)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 text-sm transition-colors',
                  isSelected
                    ? 'bg-primary-50 dark:bg-primary-900/20'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800',
                )}
              >
                <span
                  className="flex items-center justify-center h-6 w-6 rounded text-xs font-medium text-white shrink-0"
                  style={{ backgroundColor: project.color ?? '#4f46e5' }}
                >
                  {project.icon ?? project.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate flex-1 text-left text-zinc-900 dark:text-zinc-100">{project.name}</span>
                {isSelected && <Check className="h-4 w-4 text-primary-600 shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
