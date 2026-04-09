import { useForm, useUpdateForm } from '@/hooks/use-forms';
import { ChevronLeft } from 'lucide-react';

interface FormSettingsPageProps {
  formId: string;
  onNavigate: (path: string) => void;
}

export function FormSettingsPage({ formId, onNavigate }: FormSettingsPageProps) {
  const { data } = useForm(formId);
  const updateMutation = useUpdateForm(formId);

  const form = data?.data;

  const handleUpdate = (patch: Record<string, unknown>) => {
    updateMutation.mutate(patch as any);
  };

  if (!form) {
    return <div className="p-6"><div className="h-96 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => onNavigate(`/forms/${formId}/edit`)}
          className="p-1 text-zinc-400 hover:text-zinc-600"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {form.name} — Settings
        </h1>
      </div>

      <div className="space-y-6">
        {/* Access */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Access</h2>
          <div className="space-y-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Form Type</div>
                <div className="text-xs text-zinc-500">Controls who can access this form</div>
              </div>
              <select
                value={form.form_type}
                onChange={(e) => handleUpdate({ form_type: e.target.value })}
                className="text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-1.5 bg-white dark:bg-zinc-800"
              >
                <option value="public">Public</option>
                <option value="internal">Internal</option>
                <option value="embedded">Embedded</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Accept Responses</div>
                <div className="text-xs text-zinc-500">Toggle whether new submissions are accepted</div>
              </div>
              <input
                type="checkbox"
                checked={form.accept_responses}
                onChange={(e) => handleUpdate({ accept_responses: e.target.checked })}
                className="rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">One per Email</div>
                <div className="text-xs text-zinc-500">Limit to one submission per email address</div>
              </div>
              <input
                type="checkbox"
                checked={form.one_per_email ?? false}
                onChange={(e) => handleUpdate({ one_per_email: e.target.checked })}
                className="rounded"
              />
            </div>
          </div>
        </section>

        {/* Confirmation */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Confirmation</h2>
          <div className="space-y-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Type</label>
              <select
                value={form.confirmation_type}
                onChange={(e) => handleUpdate({ confirmation_type: e.target.value })}
                className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800"
              >
                <option value="message">Show Message</option>
                <option value="redirect">Redirect</option>
                <option value="page">Custom Page</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Confirmation Message</label>
              <textarea
                defaultValue={form.confirmation_message ?? ''}
                onBlur={(e) => handleUpdate({ confirmation_message: e.target.value })}
                className="w-full text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800"
                rows={3}
              />
            </div>
          </div>
        </section>

        {/* Branding */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Branding</h2>
          <div className="space-y-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Theme Color</div>
              </div>
              <input
                type="color"
                defaultValue={form.theme_color ?? '#3b82f6'}
                onChange={(e) => handleUpdate({ theme_color: e.target.value })}
                className="h-8 w-12 rounded border border-zinc-300 dark:border-zinc-600 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Show Progress Bar</div>
                <div className="text-xs text-zinc-500">For multi-page forms</div>
              </div>
              <input
                type="checkbox"
                checked={form.show_progress_bar}
                onChange={(e) => handleUpdate({ show_progress_bar: e.target.checked })}
                className="rounded"
              />
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Notifications</h2>
          <div className="space-y-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Email on Submit</div>
                <div className="text-xs text-zinc-500">Get notified when someone submits this form</div>
              </div>
              <input
                type="checkbox"
                checked={form.notify_on_submit ?? false}
                onChange={(e) => handleUpdate({ notify_on_submit: e.target.checked })}
                className="rounded"
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
