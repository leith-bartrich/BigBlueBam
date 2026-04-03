import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft, Activity, Filter } from 'lucide-react';
import type { PaginatedResponse } from '@bigbluebam/shared';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/common/button';
import { Select } from '@/components/common/select';
import { DatePicker } from '@/components/common/date-picker';
import { Avatar } from '@/components/common/avatar';
import { Badge } from '@/components/common/badge';
import { useProject } from '@/hooks/use-projects';
import { api } from '@/lib/api';
import { formatDate, formatRelativeTime } from '@/lib/utils';

interface AuditLogPageProps {
  projectId: string;
  onNavigate: (path: string) => void;
}

interface ActivityEntry {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: Record<string, unknown>;
  created_at: string;
  actor?: { display_name: string; avatar_url: string | null };
}

interface Member {
  id: string;
  user_id: string;
  display_name: string;
}

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'moved', label: 'Moved' },
  { value: 'commented', label: 'Commented' },
  { value: 'assigned', label: 'Assigned' },
];

const ACTION_COLORS: Record<string, string> = {
  created: 'success',
  updated: 'info',
  deleted: 'danger',
  moved: 'warning',
  commented: 'primary',
  assigned: 'default',
};

export function AuditLogPage({ projectId, onNavigate }: AuditLogPageProps) {
  const { data: projectRes } = useProject(projectId);
  const project = projectRes?.data;

  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const { data: membersRes } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.get<PaginatedResponse<Member>>(`/projects/${projectId}/members`),
    enabled: !!projectId,
  });
  const members = membersRes?.data ?? [];

  const params: Record<string, string | number> = { limit: 100 };
  if (filterAction) params['action'] = filterAction;
  if (filterUser) params['actor_id'] = filterUser;
  if (filterDateFrom) params['from'] = filterDateFrom;
  if (filterDateTo) params['to'] = filterDateTo;

  const { data: activityRes, isLoading } = useQuery({
    queryKey: ['project-audit', projectId, params],
    queryFn: () =>
      api.get<PaginatedResponse<ActivityEntry>>(`/projects/${projectId}/activity`, params),
    enabled: !!projectId,
  });
  const activities = activityRes?.data ?? [];

  const memberOptions = [
    { value: '__all__', label: 'All Users' },
    ...members.map((m) => ({ value: m.id, label: m.display_name })),
  ];

  const formatChanges = (changes: Record<string, unknown>): string => {
    if (!changes || Object.keys(changes).length === 0) return '';
    const parts: string[] = [];
    for (const [key, value] of Object.entries(changes)) {
      if (typeof value === 'object' && value !== null && 'from' in value && 'to' in value) {
        const v = value as { from: unknown; to: unknown };
        parts.push(`${key}: ${String(v.from)} -> ${String(v.to)}`);
      } else {
        parts.push(`${key}: ${String(value)}`);
      }
    }
    return parts.join(', ');
  };

  return (
    <AppLayout
      currentProjectId={projectId}
      breadcrumbs={[
        { label: 'Projects', href: '/' },
        { label: project?.name ?? 'Loading...', href: `/projects/${projectId}/board` },
        { label: 'Audit Log' },
      ]}
      onNavigate={onNavigate}
      onCreateProject={() => onNavigate('/')}
    >
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(`/projects/${projectId}/board`)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Audit Log
          </h1>
        </div>

        {/* Filters */}
        <div className="flex items-end gap-3 mb-6 flex-wrap bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <Filter className="h-4 w-4 text-zinc-400 shrink-0 mb-2" />
          <Select
            label="Action"
            options={ACTION_OPTIONS}
            value={filterAction}
            onValueChange={setFilterAction}
            className="w-40"
          />
          <Select
            label="User"
            options={memberOptions}
            value={filterUser}
            onValueChange={setFilterUser}
            className="w-48"
          />
          <DatePicker
            label="From"
            value={filterDateFrom}
            onChange={(val) => setFilterDateFrom(val)}
          />
          <DatePicker
            label="To"
            value={filterDateTo}
            onChange={(val) => setFilterDateTo(val)}
          />
          {(filterAction || filterUser || filterDateFrom || filterDateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterAction('');
                setFilterUser('');
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-20">
            <Activity className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
            <p className="text-sm text-zinc-500">No activity entries found.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">User</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">Target</th>
                  <th className="text-left px-4 py-3 font-medium text-zinc-500">Details</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((entry) => {
                  const actionWord = entry.action.split(' ')[0]?.toLowerCase() ?? '';
                  const badgeVariant = (ACTION_COLORS[actionWord] ?? 'default') as
                    | 'default'
                    | 'success'
                    | 'info'
                    | 'danger'
                    | 'warning'
                    | 'primary';

                  return (
                    <tr
                      key={entry.id}
                      className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-zinc-500" title={formatDate(entry.created_at)}>
                          {formatRelativeTime(entry.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={entry.actor?.avatar_url}
                            name={entry.actor?.display_name}
                            size="sm"
                          />
                          <span className="text-zinc-700 dark:text-zinc-300">
                            {entry.actor?.display_name ?? 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badgeVariant}>{entry.action}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-zinc-500 capitalize">{entry.entity_type}</span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <span className="text-zinc-400 text-xs truncate block">
                          {formatChanges(entry.changes)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
