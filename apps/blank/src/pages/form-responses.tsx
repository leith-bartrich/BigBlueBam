import { useState } from 'react';
import { useForm, useFormSubmissions } from '@/hooks/use-forms';
import { formatDate } from '@/lib/utils';
import { Download, ChevronLeft, BarChart3 } from 'lucide-react';

interface FormResponsesPageProps {
  formId: string;
  onNavigate: (path: string) => void;
}

const FILE_STATUS_FILTERS = ['', 'pending', 'processing', 'complete', 'failed'] as const;

const statusClass: Record<string, string> = {
  pending: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  complete: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function FormResponsesPage({ formId, onNavigate }: FormResponsesPageProps) {
  const { data: formData } = useForm(formId);
  const { data: subsData, isLoading } = useFormSubmissions(formId);
  const [fileStatusFilter, setFileStatusFilter] = useState<string>('');

  const form = formData?.data;
  const allSubmissions = (subsData?.data ?? []) as Array<{
    id: string;
    response_data: Record<string, unknown>;
    submitted_by_email: string | null;
    submitted_at: string;
    file_processing_status?: string | null;
  }>;
  const submissions = fileStatusFilter
    ? allSubmissions.filter((s) => (s.file_processing_status ?? 'pending') === fileStatusFilter)
    : allSubmissions;
  const fields = form?.fields ?? [];

  const displayFields = fields.filter((f) => !['section_header', 'paragraph', 'hidden'].includes(f.field_type));

  const handleExport = () => {
    window.open(`/blank/api/v1/forms/${formId}/submissions/export`, '_blank');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(`/forms/${formId}/edit`)}
            className="p-1 text-zinc-400 hover:text-zinc-600"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {form?.name} — Responses
            </h1>
            <p className="text-sm text-zinc-500">{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate(`/forms/${formId}/analytics`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            <BarChart3 className="h-4 w-4" /> Analytics
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 text-sm">
        <span className="text-zinc-500">Attachment status:</span>
        {FILE_STATUS_FILTERS.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setFileStatusFilter(s)}
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              fileStatusFilter === s
                ? 'bg-primary-600 text-white'
                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
            }`}
          >
            {s || 'all'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
      ) : submissions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-zinc-500">No responses yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                <th className="px-4 py-3 text-left font-medium text-zinc-500">#</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Email</th>
                {displayFields.slice(0, 5).map((f) => (
                  <th key={f.id} className="px-4 py-3 text-left font-medium text-zinc-500 max-w-[200px] truncate">
                    {f.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Files</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub, i) => (
                <tr
                  key={sub.id}
                  className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                >
                  <td className="px-4 py-3 text-zinc-400">{i + 1}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{sub.submitted_by_email ?? '--'}</td>
                  {displayFields.slice(0, 5).map((f) => {
                    const val = sub.response_data[f.field_key];
                    const display = val === null || val === undefined ? '--' : Array.isArray(val) ? val.join(', ') : String(val);
                    return (
                      <td key={f.id} className="px-4 py-3 text-zinc-700 dark:text-zinc-300 max-w-[200px] truncate">
                        {display}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    {(() => {
                      const s = sub.file_processing_status ?? 'pending';
                      const cls = statusClass[s] ?? statusClass.pending;
                      return (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}>
                          {s}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{formatDate(sub.submitted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
