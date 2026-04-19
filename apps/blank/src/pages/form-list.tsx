import { Plus, FileText, Copy, Trash2, Eye, MoreHorizontal, Send } from 'lucide-react';
import { useForms, useCreateForm, useDeleteForm, useDuplicateForm } from '@/hooks/use-forms';
import { formatRelativeTime, cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/common/dropdown-menu';

interface FormListPageProps {
  onNavigate: (path: string) => void;
}

const statusColors: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  published: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  archived: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500',
};

export function FormListPage({ onNavigate }: FormListPageProps) {
  const { data, isLoading } = useForms();
  const createMutation = useCreateForm();
  const deleteMutation = useDeleteForm();
  const duplicateMutation = useDuplicateForm();

  const forms = data?.data ?? [];

  const handleCreate = async () => {
    const slug = `form-${Date.now().toString(36)}`;
    const result = await createMutation.mutateAsync({
      name: 'Untitled Form',
      slug,
    });
    if (result?.data?.id) {
      onNavigate(`/forms/${result.data.id}/edit`);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Forms</h1>
          <p className="text-sm text-zinc-500 mt-1">Build forms and surveys to capture responses from anyone.</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={createMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          New Form
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : forms.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">No forms yet</h3>
          <p className="text-sm text-zinc-500 mt-1">Create your first form to start collecting responses.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form) => (
            <div
              key={form.id}
              className="group relative rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-5 hover:border-primary-300 dark:hover:border-primary-700 transition-colors cursor-pointer"
              onClick={() => onNavigate(`/forms/${form.id}/edit`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary-500" />
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{form.name}</h3>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu
                    trigger={
                      <button className="p-1 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    }
                  >
                    <DropdownMenuItem onSelect={() => onNavigate(`/forms/${form.id}/preview`)}>
                      <Eye className="h-4 w-4" /> Preview
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onNavigate(`/forms/${form.id}/responses`)}>
                      <Send className="h-4 w-4" /> Responses
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => duplicateMutation.mutate(form.id)}>
                      <Copy className="h-4 w-4" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => deleteMutation.mutate(form.id)} destructive>
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenu>
                </div>
              </div>
              {form.description && (
                <p className="text-sm text-zinc-500 line-clamp-2 mb-3">{form.description}</p>
              )}
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium capitalize', statusColors[form.status] ?? statusColors.draft)}>
                  {form.status}
                </span>
                <div className="flex items-center gap-3">
                  <span>{form.field_count ?? 0} fields</span>
                  <span>{form.submission_count ?? 0} responses</span>
                  <span>{formatRelativeTime(form.updated_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
