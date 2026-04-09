import { useState } from 'react';
import { Plus, BarChart3, Copy, Trash2, Eye, MoreHorizontal, Globe, Lock, Users } from 'lucide-react';
import { useDashboards, useCreateDashboard, useDeleteDashboard, useDuplicateDashboard } from '@/hooks/use-dashboards';
import { formatRelativeTime, cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/common/dropdown-menu';

interface DashboardListPageProps {
  onNavigate: (path: string) => void;
}

const visibilityIcon = {
  private: Lock,
  project: Users,
  organization: Globe,
};

export function DashboardListPage({ onNavigate }: DashboardListPageProps) {
  const { data, isLoading } = useDashboards();
  const createMutation = useCreateDashboard();
  const deleteMutation = useDeleteDashboard();
  const duplicateMutation = useDuplicateDashboard();

  const dashboards = data?.data ?? [];

  const handleCreate = async () => {
    const result = await createMutation.mutateAsync({
      name: 'Untitled Dashboard',
      visibility: 'private',
    });
    if (result?.data?.id) {
      onNavigate(`/dashboards/${result.data.id}/edit`);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Dashboards</h1>
          <p className="text-sm text-zinc-500 mt-1">Build and share analytics dashboards across the BigBlueBam suite.</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          New Dashboard
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : dashboards.length === 0 ? (
        <div className="text-center py-16">
          <BarChart3 className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">No dashboards yet</h3>
          <p className="text-sm text-zinc-500 mt-1">Create your first dashboard to start visualizing data.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((dash) => {
            const VisIcon = visibilityIcon[dash.visibility as keyof typeof visibilityIcon] ?? Lock;
            return (
              <div
                key={dash.id}
                className="group relative rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-5 hover:border-primary-300 dark:hover:border-primary-700 transition-colors cursor-pointer"
                onClick={() => onNavigate(`/dashboards/${dash.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary-500" />
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{dash.name}</h3>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu
                      trigger={
                        <button className="p-1 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      }
                    >
                      <DropdownMenuItem onSelect={() => onNavigate(`/dashboards/${dash.id}`)}>
                        <Eye className="h-4 w-4" /> View
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => duplicateMutation.mutate(dash.id)}>
                        <Copy className="h-4 w-4" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => deleteMutation.mutate(dash.id)} destructive>
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenu>
                  </div>
                </div>
                {dash.description && (
                  <p className="text-sm text-zinc-500 line-clamp-2 mb-3">{dash.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <VisIcon className="h-3.5 w-3.5" />
                    <span className="capitalize">{dash.visibility}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{dash.widget_count ?? 0} widgets</span>
                    <span>{formatRelativeTime(dash.updated_at)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
