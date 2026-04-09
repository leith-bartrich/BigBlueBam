import { useState } from 'react';
import { Plus, Globe, CheckCircle, XCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface SenderDomain {
  id: string;
  domain: string;
  spf_verified: boolean;
  dkim_verified: boolean;
  dmarc_verified: boolean;
  verified_at: string | null;
  dns_records: Array<{ type: string; name: string; value: string }>;
  created_at: string;
}

export function DomainSettingsPage() {
  const [newDomain, setNewDomain] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['blast', 'sender-domains'],
    queryFn: () => api.get<{ data: SenderDomain[] }>('/v1/sender-domains'),
  });

  const addDomain = useMutation({
    mutationFn: (domain: string) => api.post('/v1/sender-domains', { domain }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blast', 'sender-domains'] });
      setNewDomain('');
    },
  });

  const verifyDomain = useMutation({
    mutationFn: (id: string) => api.post(`/v1/sender-domains/${id}/verify`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blast', 'sender-domains'] }),
  });

  const deleteDomain = useMutation({
    mutationFn: (id: string) => api.delete(`/v1/sender-domains/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blast', 'sender-domains'] }),
  });

  const domains = data?.data ?? [];

  function VerifyIcon({ verified }: { verified: boolean }) {
    return verified
      ? <CheckCircle className="h-4 w-4 text-green-500" />
      : <XCircle className="h-4 w-4 text-zinc-300 dark:text-zinc-600" />;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Sender Domains</h1>
        <p className="text-sm text-zinc-500 mt-1">Verify your sending domains for better deliverability</p>
      </div>

      {/* Add domain */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          placeholder="e.g., company.com"
          className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
        <button
          onClick={() => newDomain && addDomain.mutate(newDomain)}
          disabled={!newDomain || addDomain.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Add Domain
        </button>
      </div>

      {/* Domain list */}
      {isLoading ? (
        <div className="text-center py-10 text-zinc-500">Loading domains...</div>
      ) : domains.length === 0 ? (
        <div className="text-center py-10">
          <Globe className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">No sender domains configured</p>
        </div>
      ) : (
        <div className="space-y-4">
          {domains.map((domain) => (
            <div key={domain.id} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{domain.domain}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => verifyDomain.mutate(domain.id)}
                    className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600"
                    title="Verify DNS"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm('Remove this domain?')) deleteDomain.mutate(domain.id); }}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-600"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <div className="flex items-center gap-1.5">
                  <VerifyIcon verified={domain.spf_verified} />
                  <span className="text-zinc-600 dark:text-zinc-400">SPF</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <VerifyIcon verified={domain.dkim_verified} />
                  <span className="text-zinc-600 dark:text-zinc-400">DKIM</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <VerifyIcon verified={domain.dmarc_verified} />
                  <span className="text-zinc-600 dark:text-zinc-400">DMARC</span>
                </div>
              </div>
              {domain.dns_records && domain.dns_records.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-medium text-zinc-500 mb-2">Required DNS Records:</p>
                  <div className="space-y-1">
                    {domain.dns_records.map((record, i) => (
                      <div key={i} className="flex gap-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-800 rounded px-2 py-1">
                        <span className="text-zinc-500 w-12">{record.type}</span>
                        <span className="text-zinc-600 dark:text-zinc-400 w-32">{record.name}</span>
                        <span className="text-zinc-900 dark:text-zinc-100 flex-1 truncate">{record.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
