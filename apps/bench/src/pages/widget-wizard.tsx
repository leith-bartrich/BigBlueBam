import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useDataSources } from '@/hooks/use-data-sources';
import { cn } from '@/lib/utils';

interface WidgetWizardPageProps {
  onNavigate: (path: string) => void;
}

type Step = 'source' | 'measures' | 'chart' | 'style';

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

export function WidgetWizardPage({ onNavigate }: WidgetWizardPageProps) {
  const { data: sourcesData, isLoading } = useDataSources();
  const sources = sourcesData?.data ?? [];

  const [step, setStep] = useState<Step>('source');
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedMeasures, setSelectedMeasures] = useState<string[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [widgetType, setWidgetType] = useState('bar_chart');
  const [widgetName, setWidgetName] = useState('');

  const currentSource = sources.find(
    (s) => `${s.product}:${s.entity}` === selectedSource,
  );

  const steps: { key: Step; label: string }[] = [
    { key: 'source', label: 'Data Source' },
    { key: 'measures', label: 'Measures & Dimensions' },
    { key: 'chart', label: 'Chart Type' },
    { key: 'style', label: 'Name & Style' },
  ];

  const stepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => onNavigate('/')}
          className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">New Widget</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-full text-xs font-medium',
                i === stepIndex
                  ? 'bg-primary-600 text-white'
                  : i < stepIndex
                    ? 'bg-green-500 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500',
              )}
            >
              {i < stepIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={cn('text-sm', i === stepIndex ? 'text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-500')}>{s.label}</span>
            {i < steps.length - 1 && <div className="w-8 h-px bg-zinc-200 dark:bg-zinc-700" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 'source' && (
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-zinc-400">Loading data sources...</div>
          ) : (
            sources.map((s) => {
              const key = `${s.product}:${s.entity}`;
              const selected = selectedSource === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedSource(key)}
                  className={cn(
                    'w-full text-left p-4 rounded-lg border transition-colors',
                    selected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-primary-300',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase bg-zinc-100 dark:bg-zinc-700 text-zinc-500 rounded px-1.5 py-0.5">{s.product}</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{s.label}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{s.description}</p>
                </button>
              );
            })
          )}
        </div>
      )}

      {step === 'measures' && currentSource && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Measures</h3>
            <div className="space-y-1">
              {currentSource.measures.map((m) => (
                <label key={m.field} className="flex items-center gap-2 p-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedMeasures.includes(m.field)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedMeasures([...selectedMeasures, m.field]);
                      else setSelectedMeasures(selectedMeasures.filter((f) => f !== m.field));
                    }}
                    className="rounded"
                  />
                  <span className="text-sm text-zinc-900 dark:text-zinc-100">{m.label}</span>
                  <span className="text-[10px] text-zinc-400">{m.aggregations.join(', ')}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Dimensions</h3>
            <div className="space-y-1">
              {currentSource.dimensions.map((d) => (
                <label key={d.field} className="flex items-center gap-2 p-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDimensions.includes(d.field)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedDimensions([...selectedDimensions, d.field]);
                      else setSelectedDimensions(selectedDimensions.filter((f) => f !== d.field));
                    }}
                    className="rounded"
                  />
                  <span className="text-sm text-zinc-900 dark:text-zinc-100">{d.label}</span>
                  <span className="text-[10px] text-zinc-400">{d.type}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'chart' && (
        <div className="grid grid-cols-3 gap-3">
          {WIDGET_TYPES.map((wt) => (
            <button
              key={wt.value}
              onClick={() => setWidgetType(wt.value)}
              className={cn(
                'p-4 rounded-lg border text-center transition-colors',
                widgetType === wt.value
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20'
                  : 'border-zinc-200 dark:border-zinc-700 hover:border-primary-300',
              )}
            >
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{wt.label}</div>
            </button>
          ))}
        </div>
      )}

      {step === 'style' && (
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Widget Name</label>
            <input
              type="text"
              value={widgetName}
              onChange={(e) => setWidgetName(e.target.value)}
              placeholder="e.g., Task Completion by Priority"
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-600 dark:text-zinc-400">
            <p><strong>Source:</strong> {currentSource?.label ?? 'None'}</p>
            <p><strong>Measures:</strong> {selectedMeasures.join(', ') || 'None'}</p>
            <p><strong>Dimensions:</strong> {selectedDimensions.join(', ') || 'None'}</p>
            <p><strong>Type:</strong> {widgetType.replace('_', ' ')}</p>
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-zinc-200 dark:border-zinc-700">
        <button
          onClick={() => {
            if (stepIndex > 0) setStep(steps[stepIndex - 1]!.key);
            else onNavigate('/');
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {stepIndex === 0 ? 'Cancel' : 'Back'}
        </button>
        <button
          onClick={() => {
            if (stepIndex < steps.length - 1) setStep(steps[stepIndex + 1]!.key);
            else {
              // Create widget (would call API)
              onNavigate('/');
            }
          }}
          disabled={step === 'source' && !selectedSource}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {stepIndex === steps.length - 1 ? 'Create Widget' : 'Next'}
          {stepIndex < steps.length - 1 && <ArrowRight className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
