import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { useCreateSegment } from '@/hooks/use-segments';

interface SegmentBuilderPageProps {
  onNavigate: (path: string) => void;
}

interface Condition {
  field: string;
  op: string;
  value: string;
}

const FIELDS = [
  { value: 'lifecycle_stage', label: 'Lifecycle Stage' },
  { value: 'lead_source', label: 'Lead Source' },
  { value: 'lead_score', label: 'Lead Score' },
  { value: 'city', label: 'City' },
  { value: 'country', label: 'Country' },
  { value: 'last_contacted_at', label: 'Last Contacted' },
];

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'in', label: 'is one of' },
  { value: 'contains', label: 'contains' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'older_than_days', label: 'older than (days)' },
];

export function SegmentBuilderPage({ onNavigate }: SegmentBuilderPageProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [match, setMatch] = useState<'all' | 'any'>('all');
  const [conditions, setConditions] = useState<Condition[]>([
    { field: 'lifecycle_stage', op: 'equals', value: '' },
  ]);

  const createSegment = useCreateSegment();

  const addCondition = () => {
    setConditions([...conditions, { field: 'lifecycle_stage', op: 'equals', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    setConditions(conditions.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  const handleSave = async () => {
    if (!name || conditions.length === 0) return;

    try {
      await createSegment.mutateAsync({
        name,
        description: description || undefined,
        filter_criteria: {
          conditions: conditions.map((c) => ({
            field: c.field,
            op: c.op,
            value: c.op === 'in' ? c.value.split(',').map((v) => v.trim()) : c.value,
          })),
          match,
        },
      });
      onNavigate('/segments');
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigate('/segments')}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">New Segment</h1>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Segment Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Active Leads"
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description..."
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Match mode */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Match</label>
          <div className="flex gap-2">
            <button
              onClick={() => setMatch('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${match === 'all' ? 'bg-red-600 text-white' : 'border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
            >
              ALL conditions (AND)
            </button>
            <button
              onClick={() => setMatch('any')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${match === 'any' ? 'bg-red-600 text-white' : 'border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
            >
              ANY condition (OR)
            </button>
          </div>
        </div>

        {/* Conditions */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Conditions</label>
          {conditions.map((condition, index) => (
            <div key={index} className="flex gap-2 items-center">
              <select
                value={condition.field}
                onChange={(e) => updateCondition(index, { field: e.target.value })}
                className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
              >
                {FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <select
                value={condition.op}
                onChange={(e) => updateCondition(index, { op: e.target.value })}
                className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
              >
                {OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={condition.value}
                onChange={(e) => updateCondition(index, { value: e.target.value })}
                placeholder="Value"
                className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {conditions.length > 1 && (
                <button
                  onClick={() => removeCondition(index)}
                  className="p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addCondition}
            className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700 font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Condition
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={!name || conditions.length === 0 || createSegment.isPending}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            <Save className="h-4 w-4" />
            {createSegment.isPending ? 'Saving...' : 'Create Segment'}
          </button>
          <button
            onClick={() => onNavigate('/segments')}
            className="px-6 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
