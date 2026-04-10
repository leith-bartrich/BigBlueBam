import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Loader2, RefreshCw } from 'lucide-react';
import { useWidget, useUpdateWidget, useWidgetQuery } from '@/hooks/use-widgets';
import { useDataSources } from '@/hooks/use-data-sources';
import { ChartRenderer } from '@/components/widgets/chart-renderer';
import { cn } from '@/lib/utils';

interface WidgetEditPageProps {
  widgetId: string;
  onNavigate: (path: string) => void;
}

const WIDGET_TYPES = [
  { value: 'bar_chart', label: 'Bar Chart' },
  { value: 'line_chart', label: 'Line Chart' },
  { value: 'area_chart', label: 'Area Chart' },
  { value: 'pie_chart', label: 'Pie Chart' },
  { value: 'donut_chart', label: 'Donut Chart' },
  { value: 'kpi_card', label: 'KPI Card' },
  { value: 'counter', label: 'Counter' },
  { value: 'table', label: 'Table' },
  { value: 'funnel', label: 'Funnel' },
  { value: 'gauge', label: 'Gauge' },
  { value: 'progress_bar', label: 'Progress Bar' },
];

export function WidgetEditPage({ widgetId, onNavigate }: WidgetEditPageProps) {
  const { data: widgetData, isLoading: widgetLoading } = useWidget(widgetId);
  const { data: queryData, isLoading: queryLoading, refetch: refetchQuery } = useWidgetQuery(widgetId);
  const { data: sourcesData } = useDataSources();
  const updateWidget = useUpdateWidget();

  const widget = widgetData?.data;
  const queryResult = queryData?.data;
  const sources = sourcesData?.data ?? [];

  // Form state
  const [name, setName] = useState('');
  const [widgetType, setWidgetType] = useState('bar_chart');
  const [dataSource, setDataSource] = useState('');
  const [entity, setEntity] = useState('');
  const [selectedMeasures, setSelectedMeasures] = useState<string[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [showLegend, setShowLegend] = useState(true);
  const [stacked, setStacked] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Populate form from loaded widget
  useEffect(() => {
    if (widget && !initialized) {
      setName(widget.name);
      setWidgetType(widget.widget_type);
      setDataSource(widget.data_source);
      setEntity(widget.entity);

      const qc = widget.query_config;
      if (Array.isArray(qc.measures)) {
        setSelectedMeasures(qc.measures.map((m: any) => m.field));
      }
      if (Array.isArray(qc.dimensions)) {
        setSelectedDimensions(qc.dimensions.map((d: any) => d.field));
      }

      const vc = widget.viz_config ?? {};
      setShowLegend(vc.show_legend !== false);
      setStacked(vc.stacked === true);

      setInitialized(true);
    }
  }, [widget, initialized]);

  const currentSource = sources.find(
    (s) => s.product === dataSource && s.entity === entity,
  );

  const handleSave = async () => {
    const queryConfig: Record<string, unknown> = {
      measures: selectedMeasures.map((field) => {
        const measureDef = currentSource?.measures.find((m) => m.field === field);
        const agg = measureDef?.aggregations?.[0] ?? 'count';
        return { field, agg, alias: field };
      }),
      dimensions: selectedDimensions.map((field) => ({ field, alias: field })),
    };

    await updateWidget.mutateAsync({
      id: widgetId,
      name,
      widget_type: widgetType,
      data_source: dataSource,
      entity,
      query_config: queryConfig,
      viz_config: { show_legend: showLegend, stacked },
    });

    if (widget) {
      onNavigate(`/dashboards/${widget.dashboard_id}/edit`);
    }
  };

  if (widgetLoading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse" />
      </div>
    );
  }

  if (!widget) {
    return (
      <div className="p-6 text-center text-zinc-500">Widget not found.</div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(`/dashboards/${widget.dashboard_id}/edit`)}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Edit Widget</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={updateWidget.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {updateWidget.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Configuration */}
        <div className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Widget Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* Data Source */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Data Source</label>
            <select
              value={`${dataSource}:${entity}`}
              onChange={(e) => {
                const [p, ent] = e.target.value.split(':');
                setDataSource(p ?? '');
                setEntity(ent ?? '');
                setSelectedMeasures([]);
                setSelectedDimensions([]);
              }}
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            >
              {sources.map((s) => (
                <option key={`${s.product}:${s.entity}`} value={`${s.product}:${s.entity}`}>
                  {s.product.toUpperCase()} - {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Chart Type */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Chart Type</label>
            <div className="grid grid-cols-3 gap-2">
              {WIDGET_TYPES.map((wt) => (
                <button
                  key={wt.value}
                  onClick={() => setWidgetType(wt.value)}
                  className={cn(
                    'px-3 py-2 rounded-lg border text-xs font-medium text-center transition-colors',
                    widgetType === wt.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-300'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-primary-300',
                  )}
                >
                  {wt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Measures & Dimensions */}
          {currentSource && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Measures</h3>
                <div className="space-y-1">
                  {currentSource.measures.map((m) => (
                    <label key={m.field} className="flex items-center gap-2 p-1.5 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMeasures.includes(m.field)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedMeasures([...selectedMeasures, m.field]);
                          else setSelectedMeasures(selectedMeasures.filter((f) => f !== m.field));
                        }}
                        className="rounded"
                      />
                      <span className="text-xs text-zinc-900 dark:text-zinc-100">{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Dimensions</h3>
                <div className="space-y-1">
                  {currentSource.dimensions.map((d) => (
                    <label key={d.field} className="flex items-center gap-2 p-1.5 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedDimensions.includes(d.field)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedDimensions([...selectedDimensions, d.field]);
                          else setSelectedDimensions(selectedDimensions.filter((f) => f !== d.field));
                        }}
                        className="rounded"
                      />
                      <span className="text-xs text-zinc-900 dark:text-zinc-100">{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Viz Options */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Display Options</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLegend}
                  onChange={(e) => setShowLegend(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Show legend</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stacked}
                  onChange={(e) => setStacked(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">Stacked</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Preview</h3>
            <button
              onClick={() => refetchQuery()}
              className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 p-4 min-h-[300px] flex items-center justify-center">
            {queryLoading ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading preview...
              </div>
            ) : (
              <div className="w-full">
                <ChartRenderer
                  widgetType={widgetType}
                  data={queryResult?.rows ?? []}
                  vizConfig={{ show_legend: showLegend, stacked }}
                  widgetName={name}
                  kpiConfig={widget.kpi_config}
                />
              </div>
            )}
          </div>
          {queryResult?.duration_ms != null && (
            <div className="text-[10px] text-zinc-400 mt-1.5">
              Query took {queryResult.duration_ms}ms &middot; {queryResult.rows?.length ?? 0} rows
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
