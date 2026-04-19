import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRates, useCreateRate, useDeleteRate } from '@/hooks/use-rates';
import { formatCents, formatDate } from '@/lib/utils';

interface Props {
  onNavigate: (path: string) => void;
}

export function RateListPage({ onNavigate: _onNavigate }: Props) {
  const { data: rates, isLoading } = useRates();
  const createRate = useCreateRate();
  const deleteRate = useDeleteRate();
  const [showForm, setShowForm] = useState(false);
  const [rateAmount, setRateAmount] = useState(15000);
  const [rateType, setRateType] = useState('hourly');

  const handleCreate = async () => {
    await createRate.mutateAsync({
      rate_amount: rateAmount,
      rate_type: rateType,
    });
    setShowForm(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Billing Rates</h1>
          <p className="text-sm text-zinc-500 mt-1">Configure hourly, daily, or fixed rates per org/project/user</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          New Rate
        </button>
      </div>

      {showForm && (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Rate (cents)</label>
              <input
                type="number"
                value={rateAmount}
                onChange={(e) => setRateAmount(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Type</label>
              <select
                value={rateType}
                onChange={(e) => setRateType(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700"
          >
            Create Rate
          </button>
        </div>
      )}

      <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
              <th className="text-left px-4 py-3 font-medium text-zinc-500">Rate</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500">Type</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500">Scope</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500">Effective From</th>
              <th className="text-center px-4 py-3 font-medium text-zinc-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-12 text-zinc-400">Loading...</td></tr>
            ) : !rates?.length ? (
              <tr><td colSpan={5} className="text-center py-12 text-zinc-400">No rates configured.</td></tr>
            ) : (
              rates.map((r: any) => (
                <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-3 font-bold text-green-600">{formatCents(r.rate_amount)}</td>
                  <td className="px-4 py-3 capitalize">{r.rate_type}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {r.user_id && r.project_id ? 'User + Project' : r.user_id ? 'User' : r.project_id ? 'Project' : 'Organization'}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(r.effective_from)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => deleteRate.mutate(r.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Delete
                    </button>
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
