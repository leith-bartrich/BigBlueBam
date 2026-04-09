import { useState } from 'react';
import { Plus, Save, ArrowLeft, Trash2, GripVertical } from 'lucide-react';
import { useDashboard, useUpdateDashboard } from '@/hooks/use-dashboards';
import { useDeleteWidget } from '@/hooks/use-widgets';

interface DashboardEditPageProps {
  dashboardId: string;
  onNavigate: (path: string) => void;
}

export function DashboardEditPage({ dashboardId, onNavigate }: DashboardEditPageProps) {
  const { data, isLoading } = useDashboard(dashboardId);
  const updateMutation = useUpdateDashboard(dashboardId);
  const deleteWidgetMutation = useDeleteWidget();
  const dashboard = data?.data;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [initialized, setInitialized] = useState(false);

  if (dashboard && !initialized) {
    setName(dashboard.name);
    setDescription(dashboard.description ?? '');
    setVisibility(dashboard.visibility);
    setInitialized(true);
  }

  const handleSave = async () => {
    await updateMutation.mutateAsync({ name, description, visibility });
  };

  if (isLoading) {
    return <div className="p-6"><div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" /></div>;
  }

  if (!dashboard) {
    return <div className="p-6 text-center text-zinc-500">Dashboard not found.</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(`/dashboards/${dashboardId}`)}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Edit Dashboard</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          Save
        </button>
      </div>

      {/* Metadata */}
      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Visibility</label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="private">Private</option>
            <option value="project">Project</option>
            <option value="organization">Organization</option>
          </select>
        </div>
      </div>

      {/* Widgets */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Widgets</h2>
        <button
          onClick={() => onNavigate(`/dashboards/${dashboardId}/widgets/new`)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Widget
        </button>
      </div>

      {dashboard.widgets && dashboard.widgets.length > 0 ? (
        <div className="space-y-2">
          {dashboard.widgets.map((widget: any) => (
            <div
              key={widget.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50"
            >
              <GripVertical className="h-4 w-4 text-zinc-300 dark:text-zinc-600 cursor-grab" />
              <div className="flex-1">
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{widget.name}</div>
                <div className="text-xs text-zinc-500">{widget.data_source} / {widget.entity} - {widget.widget_type.replace('_', ' ')}</div>
              </div>
              <button
                onClick={() => onNavigate(`/widgets/${widget.id}/edit`)}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                Edit
              </button>
              <button
                onClick={() => deleteWidgetMutation.mutate(widget.id)}
                className="text-zinc-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-zinc-500 text-sm">
          No widgets yet. Click "Add Widget" to get started.
        </div>
      )}
    </div>
  );
}
