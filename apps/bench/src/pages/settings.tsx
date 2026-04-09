import { useDataSources } from '@/hooks/use-data-sources';

interface SettingsPageProps {
  onNavigate: (path: string) => void;
}

export function SettingsPage({ onNavigate }: SettingsPageProps) {
  const { data: sourcesData, isLoading } = useDataSources();
  const sources = sourcesData?.data ?? [];

  const groupedSources = sources.reduce<Record<string, typeof sources>>((acc, s) => {
    (acc[s.product] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Configure Bench data sources and preferences.</p>
      </div>

      <div className="space-y-6">
        {/* Data Source Registry */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Data Source Registry</h2>
          <p className="text-sm text-zinc-500 mb-4">Available data sources from across the BigBlueBam suite.</p>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            Object.entries(groupedSources).map(([product, sources]) => (
              <div key={product} className="mb-4">
                <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">{product}</h3>
                <div className="space-y-1">
                  {sources.map((s) => (
                    <div
                      key={`${s.product}:${s.entity}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50"
                    >
                      <div>
                        <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{s.label}</div>
                        <div className="text-xs text-zinc-500">{s.description}</div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span>{s.measures.length} measures</span>
                        <span>{s.dimensions.length} dimensions</span>
                        <span>{s.filters.length} filters</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        {/* Cache Settings */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Cache</h2>
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Default Cache TTL</div>
                <div className="text-xs text-zinc-500">Query results are cached for this duration by default.</div>
              </div>
              <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">60 seconds</span>
            </div>
          </div>
        </section>

        {/* Query Settings */}
        <section>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Query Execution</h2>
          <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Statement Timeout</div>
                <div className="text-xs text-zinc-500">Queries exceeding this limit are killed automatically.</div>
              </div>
              <span className="text-sm font-mono text-zinc-600 dark:text-zinc-400">10,000 ms</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
