import { useState } from 'react';
import { Plus, Play, Trash2, Edit2, Database, X, Save, Loader2 } from 'lucide-react';
import {
  useSavedQueries,
  useCreateSavedQuery,
  useUpdateSavedQuery,
  useDeleteSavedQuery,
  type SavedQuery,
} from '@/hooks/use-saved-queries';
import { useDataSources } from '@/hooks/use-data-sources';

interface SavedQueriesPageProps {
  onNavigate: (path: string) => void;
}

// ---------------------------------------------------------------------------
// Create / Edit dialog
// ---------------------------------------------------------------------------

interface FormData {
  name: string;
  description: string;
  data_source: string;
  entity: string;
}

const INITIAL_FORM: FormData = {
  name: '',
  description: '',
  data_source: '',
  entity: '',
};

function SavedQueryDialog({
  open,
  editing,
  onClose,
}: {
  open: boolean;
  editing: SavedQuery | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormData>(() =>
    editing
      ? {
          name: editing.name,
          description: editing.description ?? '',
          data_source: editing.data_source,
          entity: editing.entity,
        }
      : { ...INITIAL_FORM },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: sourcesData } = useDataSources();
  const sources = sourcesData?.data ?? [];

  const createMutation = useCreateSavedQuery();
  const updateMutation = editing ? useUpdateSavedQuery(editing.id) : null;

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.data_source) errs.data_source = 'Data source is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const selectedSource = sources.find(
      (s) => `${s.product}:${s.entity}` === form.data_source,
    );

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      data_source: selectedSource?.product ?? form.data_source,
      entity: selectedSource?.entity ?? form.entity,
      query_config: editing?.query_config ?? {},
    };

    try {
      if (editing && updateMutation) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync({
          ...payload,
          data_source: payload.data_source,
          entity: payload.entity,
          query_config: payload.query_config,
        });
      }
      onClose();
    } catch {
      // handled by TanStack Query
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {editing ? 'Edit Saved Query' : 'New Saved Query'}
          </h2>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="Monthly revenue breakdown"
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Optional description of what this query tracks..."
              rows={2}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          {/* Data Source */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Data Source
            </label>
            <select
              value={form.data_source}
              onChange={(e) => updateField('data_source', e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a data source...</option>
              {sources.map((s) => (
                <option key={`${s.product}:${s.entity}`} value={`${s.product}:${s.entity}`}>
                  [{s.product}] {s.label}
                </option>
              ))}
            </select>
            {errors.data_source && <p className="text-xs text-red-500 mt-1">{errors.data_source}</p>}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || (updateMutation?.isPending ?? false)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function SavedQueriesPage({ onNavigate }: SavedQueriesPageProps) {
  const { data, isLoading } = useSavedQueries();
  const deleteMutation = useDeleteSavedQuery();
  const queries = data?.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SavedQuery | null>(null);

  function handleCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function handleEdit(query: SavedQuery) {
    setEditing(query);
    setDialogOpen(true);
  }

  function handleRun(query: SavedQuery) {
    // Navigate to the explorer with query params pre-loaded
    const sourceKey = `${query.data_source}:${query.entity}`;
    onNavigate(`/explorer?source=${encodeURIComponent(sourceKey)}&saved_query_id=${query.id}`);
  }

  function handleCloseDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Saved Queries</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Reusable query definitions you can run from the ad-hoc explorer.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          New Query
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : queries.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <Database className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">No saved queries</h3>
          <p className="text-sm mt-1">
            Create a query to save and re-run later from the explorer.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {queries.map((query) => (
            <div
              key={query.id}
              className="flex items-center gap-4 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50"
            >
              <Database className="h-5 w-5 text-zinc-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {query.name}
                </div>
                {query.description && (
                  <div className="text-xs text-zinc-500 mt-0.5 truncate">
                    {query.description}
                  </div>
                )}
                <div className="text-[11px] text-zinc-400 mt-1">
                  {query.data_source}/{query.entity} - Created {formatDate(query.created_at)}
                </div>
              </div>
              <button
                onClick={() => handleRun(query)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-950/30 hover:bg-primary-100 dark:hover:bg-primary-950/50 rounded-lg transition-colors"
                title="Run in explorer"
              >
                <Play className="h-3.5 w-3.5" />
                Run
              </button>
              <button
                onClick={() => handleEdit(query)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                title="Edit"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => deleteMutation.mutate(query.id)}
                className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <SavedQueryDialog
        open={dialogOpen}
        editing={editing}
        onClose={handleCloseDialog}
      />
    </div>
  );
}
