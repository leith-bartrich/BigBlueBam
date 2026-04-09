import { useState } from 'react';
import { Clock } from 'lucide-react';

interface Props {
  onNavigate: (path: string) => void;
}

export function InvoiceFromTimePage({ onNavigate }: Props) {
  const [projectId, setProjectId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Invoice from Time Entries</h1>
          <p className="text-sm text-zinc-500">Generate an invoice from Bam time tracking data</p>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-700 dark:text-amber-400">
        This wizard requires Bam time entries integration. Currently, you can create invoices manually with line items.
        Time-to-invoice integration will be available when connected to a Bam project with billable time entries.
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Project</label>
          <input
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="Project UUID or select from list..."
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-4">
        <button
          disabled
          className="rounded-lg bg-green-600 text-white px-6 py-2 text-sm font-medium opacity-50 cursor-not-allowed"
        >
          Preview Line Items
        </button>
        <button
          onClick={() => onNavigate('/invoices/new')}
          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-6 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Create Manually Instead
        </button>
      </div>
    </div>
  );
}
