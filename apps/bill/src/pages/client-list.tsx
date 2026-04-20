import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useClients, useCreateClient } from '@/hooks/use-clients';

interface Props {
  onNavigate: (path: string) => void;
}

export function ClientListPage({ onNavigate }: Props) {
  const { data: clients, isLoading } = useClients();
  const createClient = useCreateClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleCreate = async () => {
    if (!name) return;
    await createClient.mutateAsync({ name, email: email || undefined });
    setName('');
    setEmail('');
    setShowForm(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Clients</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage billing clients</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700"
        >
          <Plus className="h-4 w-4" />
          New Client
        </button>
      </div>

      {showForm && (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="bill-client-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Name</label>
              <input
                id="bill-client-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                placeholder="Client name..."
              />
            </div>
            <div>
              <label htmlFor="bill-client-email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
              <input
                id="bill-client-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                placeholder="billing@example.com"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={createClient.isPending}
            className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            Create Client
          </button>
        </div>
      )}

      <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
              <th className="text-left px-4 py-3 font-medium text-zinc-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500">Email</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500">Phone</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500">Terms</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="text-center py-12 text-zinc-400">Loading...</td></tr>
            ) : !clients?.length ? (
              <tr><td colSpan={4} className="text-center py-12 text-zinc-400">No clients yet.</td></tr>
            ) : (
              clients.map((c: any) => (
                <tr
                  key={c.id}
                  onClick={() => onNavigate(`/clients/${c.id}`)}
                  className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer"
                >
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-zinc-500">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-zinc-500">{c.default_payment_terms_days} days</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
