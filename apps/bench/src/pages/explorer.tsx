import { useState } from 'react';
import { Play } from 'lucide-react';
import { useDataSources } from '@/hooks/use-data-sources';
import { api } from '@/lib/api';

interface ExplorerPageProps {
  onNavigate: (path: string) => void;
}

export function ExplorerPage({ onNavigate: _onNavigate }: ExplorerPageProps) {
  const { data: sourcesData } = useDataSources();
  const sources = sourcesData?.data ?? [];

  const [selectedSource, setSelectedSource] = useState('');
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);
  const [sqlText, setSqlText] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentSource = sources.find(
    (s) => `${s.product}:${s.entity}` === selectedSource,
  );

  const handleRun = async () => {
    if (!currentSource) return;
    setIsRunning(true);
    setError(null);
    try {
      const res = await api.post<{ data: { rows: Record<string, unknown>[]; sql: string; duration_ms: number } }>('/v1/query/preview', {
        data_source: currentSource.product,
        entity: currentSource.entity,
        query_config: {
          measures: currentSource.measures.slice(0, 1).map((m) => ({
            field: m.field,
            agg: m.aggregations[0],
          })),
          dimensions: currentSource.dimensions.slice(0, 2).map((d) => ({
            field: d.field,
          })),
          limit: 50,
        },
      });
      setResults(res.data.rows);
      setSqlText(res.data.sql);
      setDuration(res.data.duration_ms);
    } catch (err: any) {
      setError(err.message ?? 'Query failed');
      setResults(null);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Ad-Hoc Explorer</h1>
          <p className="text-sm text-zinc-500 mt-1">Query any data source interactively.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left panel: source selection */}
        <div className="col-span-1 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Data Source</h3>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
          >
            <option value="">Select a data source...</option>
            {sources.map((s) => (
              <option key={`${s.product}:${s.entity}`} value={`${s.product}:${s.entity}`}>
                [{s.product}] {s.label}
              </option>
            ))}
          </select>

          {currentSource && (
            <div className="space-y-2">
              <div>
                <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-1">Measures</h4>
                {currentSource.measures.map((m) => (
                  <div key={m.field} className="text-xs text-zinc-600 dark:text-zinc-400 py-0.5">
                    {m.label} <span className="text-zinc-400">({m.aggregations.join(', ')})</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-1">Dimensions</h4>
                {currentSource.dimensions.map((d) => (
                  <div key={d.field} className="text-xs text-zinc-600 dark:text-zinc-400 py-0.5">
                    {d.label} <span className="text-zinc-400">({d.type})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleRun}
            disabled={!selectedSource || isRunning}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            {isRunning ? 'Running...' : 'Run Query'}
          </button>
        </div>

        {/* Right panel: results */}
        <div className="col-span-2">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {sqlText && (
            <div className="mb-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-xs font-mono text-zinc-600 dark:text-zinc-400 overflow-x-auto">
              {sqlText}
            </div>
          )}

          {duration != null && (
            <div className="mb-3 text-xs text-zinc-400">
              {results?.length ?? 0} rows in {duration}ms
            </div>
          )}

          {results && results.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800">
                    {Object.keys(results[0]!).map((key) => (
                      <th key={key} className="px-3 py-2 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={i} className="border-t border-zinc-100 dark:border-zinc-700/50">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-3 py-1.5 text-zinc-700 dark:text-zinc-300">
                          {val == null ? <span className="text-zinc-300 dark:text-zinc-600 italic">null</span> : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : results && results.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">No results</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
