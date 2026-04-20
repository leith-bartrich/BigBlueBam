import { useRevenueSummary, useOutstanding, useProfitability, useOverdue } from '@/hooks/use-reports';
import { formatCents } from '@/lib/utils';

interface Props {
  onNavigate: (path: string) => void;
}

export function ReportsPage({ onNavigate }: Props) {
  const { data: revenue } = useRevenueSummary();
  const { data: outstanding } = useOutstanding();
  const { data: profitability } = useProfitability();
  const { data: overdue } = useOverdue();

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Financial Reports</h1>

      {/* Revenue Summary */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Revenue by Month</h2>
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b">
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Month</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Invoiced</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Collected</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Count</th>
              </tr>
            </thead>
            <tbody>
              {revenue?.length ? revenue.map((r: any, i: number) => (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-3 font-medium">{r.month}</td>
                  <td className="px-4 py-3 text-right">{formatCents(Number(r.total_invoiced))}</td>
                  <td className="px-4 py-3 text-right text-green-600">{formatCents(Number(r.total_paid))}</td>
                  <td className="px-4 py-3 text-right text-zinc-500">{r.invoice_count}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="text-center py-8 text-zinc-400">No revenue data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Outstanding Aging */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Outstanding Aging</h2>
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b">
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Client</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">0-30 days</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">31-60 days</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">61-90 days</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">90+ days</th>
              </tr>
            </thead>
            <tbody>
              {outstanding?.length ? outstanding.map((o: any, i: number) => (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-3 font-medium">{o.to_name}</td>
                  <td className="px-4 py-3 text-right">{formatCents(Number(o.bucket_0_30))}</td>
                  <td className="px-4 py-3 text-right">{formatCents(Number(o.bucket_31_60))}</td>
                  <td className="px-4 py-3 text-right">{formatCents(Number(o.bucket_61_90))}</td>
                  <td className="px-4 py-3 text-right text-red-600 font-medium">{formatCents(Number(o.bucket_90_plus))}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="text-center py-8 text-zinc-400">No outstanding invoices</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Profitability */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Project Profitability</h2>
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b">
                <th className="text-left px-4 py-3 font-medium text-zinc-500">Project</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Revenue</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Expenses</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Profit</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-500">Margin</th>
              </tr>
            </thead>
            <tbody>
              {profitability?.length ? profitability.map((p: any, i: number) => (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-3 font-medium">{p.project_id ? p.project_id.slice(0, 8) + '...' : 'Unassigned'}</td>
                  <td className="px-4 py-3 text-right">{formatCents(p.revenue)}</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatCents(p.expenses)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCents(p.profit)}</td>
                  <td className="px-4 py-3 text-right text-zinc-500">{p.margin}%</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="text-center py-8 text-zinc-400">No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overdue */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-red-600">Overdue Invoices</h2>
        <div className="border border-red-200 dark:border-red-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                <th className="text-left px-4 py-3 font-medium text-red-700 dark:text-red-400">Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-red-700 dark:text-red-400">Client</th>
                <th className="text-right px-4 py-3 font-medium text-red-700 dark:text-red-400">Amount Due</th>
                <th className="text-right px-4 py-3 font-medium text-red-700 dark:text-red-400">Days Overdue</th>
              </tr>
            </thead>
            <tbody>
              {overdue?.length ? overdue.map((inv: any) => (
                <tr
                  key={inv.id}
                  onClick={() => onNavigate(`/invoices/${inv.id}`)}
                  className="border-b border-red-100 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-900/10 cursor-pointer"
                >
                  <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                  <td className="px-4 py-3">{inv.to_name}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{formatCents(inv.amount_due)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">{inv.days_overdue}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="text-center py-8 text-green-600 font-medium">No overdue invoices</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
