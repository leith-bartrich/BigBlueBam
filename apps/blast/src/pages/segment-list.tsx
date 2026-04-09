import { useState } from 'react';
import { Plus, Search, Users, RefreshCw, Trash2 } from 'lucide-react';
import { useSegments, useDeleteSegment, useRecalculateSegmentCount } from '@/hooks/use-segments';
import { formatRelativeTime, formatNumber } from '@/lib/utils';

interface SegmentListPageProps {
  onNavigate: (path: string) => void;
}

export function SegmentListPage({ onNavigate }: SegmentListPageProps) {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useSegments({ search: search || undefined });
  const deleteSegment = useDeleteSegment();
  const recalculate = useRecalculateSegmentCount();
  const segments = data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Segments</h1>
          <p className="text-sm text-zinc-500 mt-1">Target specific groups of contacts for your campaigns</p>
        </div>
        <button
          onClick={() => onNavigate('/segments/new')}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          New Segment
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Search segments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-zinc-500">Loading segments...</div>
      ) : segments.length === 0 ? (
        <div className="text-center py-20">
          <Users className="h-12 w-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">No segments yet</h3>
          <p className="text-sm text-zinc-500 mt-1">Create segments to target specific contact groups.</p>
        </div>
      ) : (
        <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Segment</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Contacts</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Conditions</th>
                <th className="text-left px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Last Updated</th>
                <th className="text-right px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {segments.map((segment) => (
                <tr key={segment.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{segment.name}</div>
                    {segment.description && <div className="text-xs text-zinc-500">{segment.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">
                    {segment.cached_count != null ? formatNumber(segment.cached_count) : '-'}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {segment.filter_criteria.conditions?.length ?? 0} condition(s), match {segment.filter_criteria.match}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatRelativeTime(segment.updated_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => recalculate.mutate(segment.id)}
                        className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600"
                        title="Recalculate count"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this segment?')) deleteSegment.mutate(segment.id);
                        }}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
