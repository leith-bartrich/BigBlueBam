import { useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { useInvoices } from '@/hooks/use-invoices';
import { formatDate, formatCents, statusBadgeClass, cn } from '@/lib/utils';

interface Props {
  onNavigate: (path: string) => void;
}

export function InvoiceListPage({ onNavigate }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data: invoices, isLoading } = useInvoices(statusFilter ? { status: statusFilter } : undefined);

  const statuses = ['', 'draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'void'];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Invoices</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage and track all your invoices</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('/invoices/from-time')}
            className="flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            From Time Entries
          </button>
          <button
            onClick={() => onNavigate('/invoices/new')}
            className="flex items-center gap-2 rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-400" />
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'bg-green-600 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700',
              )}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
              <th className="text-left px-4 py-3 font-medium text-zinc-500">Number</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500">Client</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500">Date</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500">Due</th>
              <th className="text-right px-4 py-3 font-medium text-zinc-500">Total</th>
              <th className="text-right px-4 py-3 font-medium text-zinc-500">Due</th>
              <th className="text-center px-4 py-3 font-medium text-zinc-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-zinc-400">Loading invoices...</td>
              </tr>
            ) : !invoices?.length ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-zinc-400">No invoices yet. Create your first one.</td>
              </tr>
            ) : (
              invoices.map((inv: any) => (
                <tr
                  key={inv.id}
                  onClick={() => onNavigate(`/invoices/${inv.id}`)}
                  className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                  <td className="px-4 py-3 font-medium">{inv.to_name || '—'}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(inv.invoice_date)}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(inv.due_date)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCents(inv.total)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCents(inv.total - inv.amount_paid)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusBadgeClass(inv.status))}>
                      {inv.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
