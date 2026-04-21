import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bot, Loader2, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/common/button';
import { formatRelativeTime } from '@/lib/utils';

interface AgentsListPageProps {
  onNavigate: (path: string) => void;
}

interface AgentPolicyRow {
  agent_user_id: string;
  agent_name: string;
  enabled: boolean;
  allowed_tool_count: number;
  last_heartbeat_at: string | null;
  updated_at: string;
  created_by: { id: string; display_name: string | null } | null;
}

interface ListResponse {
  data: AgentPolicyRow[];
}

interface SetResponse {
  data: { agent_user_id: string; enabled: boolean };
  confirmation_required: boolean;
}

export function SuperuserAgentsListPage({ onNavigate }: AgentsListPageProps) {
  const { user } = useAuthStore();

  useEffect(() => {
    if (user && user.is_superuser !== true) {
      onNavigate('/');
    }
  }, [user, onNavigate]);

  if (!user || user.is_superuser !== true) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => onNavigate('/superuser')}
            className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Back to SuperUser Console"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-red-100 dark:bg-red-900/30">
            <Shield className="h-4.5 w-4.5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Agent Policies
            </h1>
            <p className="text-xs text-zinc-500">
              Enable or disable agents in the active org. §15 kill switch.
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        <AgentsTable onNavigate={onNavigate} />
      </main>
    </div>
  );
}

function AgentsTable({ onNavigate }: { onNavigate: (path: string) => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<ListResponse, Error>({
    queryKey: ['superuser', 'agent-policies'],
    queryFn: () => api.get<ListResponse>('/v1/agent-policies'),
  });

  const [pendingId, setPendingId] = useState<string | null>(null);

  const setEnabled = useMutation({
    mutationFn: ({ agentId, enabled }: { agentId: string; enabled: boolean }) =>
      api.post<SetResponse>(`/v1/agent-policies/${agentId}`, { enabled }),
    onMutate: ({ agentId }) => {
      setPendingId(agentId);
    },
    onSettled: () => {
      setPendingId(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superuser', 'agent-policies'] });
    },
  });

  const rows = data?.data ?? [];

  const handleToggle = (row: AgentPolicyRow) => {
    const next = !row.enabled;
    if (!next) {
      const ok = window.confirm(
        `Disable agent "${row.agent_name || row.agent_user_id}"?\n\nAll of its tool calls will fail-closed with AGENT_DISABLED until you re-enable it.`,
      );
      if (!ok) return;
    }
    setEnabled.mutate({ agentId: row.agent_user_id, enabled: next });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load agent policies: {error.message}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-10 text-center">
        <Bot className="h-8 w-8 text-zinc-400 mx-auto mb-3" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No agent policies in this org. Use <code className="text-xs">create-service-account</code>
          {' '}or create an agent user to see it here.
        </p>
      </div>
    );
  }

  return (
    <>
      {setEnabled.isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to update: {(setEnabled.error as Error).message}
        </div>
      )}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-2.5">Agent</th>
              <th className="px-4 py-2.5 text-right">Tools</th>
              <th className="px-4 py-2.5">Created by</th>
              <th className="px-4 py-2.5">Last heartbeat</th>
              <th className="px-4 py-2.5">Updated</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map((row) => (
              <tr
                key={row.agent_user_id}
                className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center h-7 w-7 rounded-md bg-zinc-100 dark:bg-zinc-800">
                      <Bot className="h-3.5 w-3.5 text-zinc-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {row.agent_name || '(no name)'}
                      </div>
                      <div className="font-mono text-xs text-zinc-500 truncate">
                        {row.agent_user_id}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  {row.allowed_tool_count}
                </td>
                <td className="px-4 py-3 text-xs">
                  {row.created_by ? (
                    <button
                      type="button"
                      onClick={() => onNavigate(`/superuser/people/${row.created_by!.id}`)}
                      className="text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {row.created_by.display_name || row.created_by.id.slice(0, 8)}
                    </button>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {row.last_heartbeat_at ? formatRelativeTime(row.last_heartbeat_at) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {formatRelativeTime(row.updated_at)}
                </td>
                <td className="px-4 py-3">
                  {row.enabled ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      Disabled
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant={row.enabled ? 'secondary' : 'primary'}
                    onClick={() => handleToggle(row)}
                    loading={pendingId === row.agent_user_id && setEnabled.isPending}
                    disabled={setEnabled.isPending}
                  >
                    {row.enabled ? 'Disable' : 'Enable'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Showing agents in your active org. Switch orgs from the{' '}
        <button
          type="button"
          className="underline hover:text-zinc-700 dark:hover:text-zinc-300"
          onClick={() => (window.location.href = '/b3/superuser')}
        >
          SuperUser Console
        </button>{' '}
        to see agents in a different org.
      </p>
    </>
  );
}
