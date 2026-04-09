import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Layers,
  FormInput,
  Star,
  Plus,
  Trash2,
  GripVertical,
  Edit2,
} from 'lucide-react';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { Badge } from '@/components/common/badge';
import { Dialog } from '@/components/common/dialog';
import { Select } from '@/components/common/select';
import { cn } from '@/lib/utils';
import { usePipelines, useCreatePipeline, useCreateStage, useDeleteStage, type Pipeline, type PipelineStage } from '@/hooks/use-pipelines';
import { Loader2 } from 'lucide-react';

interface SettingsPageProps {
  onNavigate: (path: string) => void;
  activeTab?: 'pipelines' | 'fields' | 'scoring';
}

/* ------------------------------------------------------------------ */
/*  Pipelines settings tab                                             */
/* ------------------------------------------------------------------ */

function PipelinesSettings() {
  const { data, isLoading } = usePipelines();
  const pipelines = data?.data ?? [];
  const createPipeline = useCreatePipeline();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [expandedPipelineId, setExpandedPipelineId] = useState<string | null>(null);

  const handleCreatePipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createPipeline.mutateAsync({
      name: newName.trim(),
      stages: [
        { name: 'Prospect', stage_type: 'active', probability_pct: 10, color: '#3b82f6' },
        { name: 'Qualified', stage_type: 'active', probability_pct: 25, color: '#8b5cf6' },
        { name: 'Proposal', stage_type: 'active', probability_pct: 50, color: '#f59e0b' },
        { name: 'Negotiation', stage_type: 'active', probability_pct: 75, color: '#f97316' },
        { name: 'Closed Won', stage_type: 'won', probability_pct: 100, color: '#16a34a' },
        { name: 'Closed Lost', stage_type: 'lost', probability_pct: 0, color: '#dc2626' },
      ],
    });
    setNewName('');
    setShowCreate(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Pipelines</h3>
          <p className="text-sm text-zinc-500 mt-0.5">Configure deal pipelines and their stages.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New Pipeline
        </Button>
      </div>

      {pipelines.length === 0 ? (
        <div className="text-center py-12 text-sm text-zinc-500">
          No pipelines configured. Create your first pipeline to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {pipelines.map((pipeline) => {
            const isExpanded = expandedPipelineId === pipeline.id;
            const stages = [...(pipeline.stages ?? [])].sort((a, b) => a.sort_order - b.sort_order);

            return (
              <div
                key={pipeline.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedPipelineId(isExpanded ? null : pipeline.id)}
                  className="flex items-center justify-between w-full px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Layers className="h-4 w-4 text-primary-500" />
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {pipeline.name}
                    </span>
                    {pipeline.is_default && <Badge variant="primary">Default</Badge>}
                    <span className="text-xs text-zinc-400">{stages.length} stages</span>
                  </div>
                  <span className="text-xs text-zinc-400">{pipeline.currency}</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 px-5 py-4">
                    <div className="space-y-2">
                      {stages.map((stage, i) => (
                        <StageRow key={stage.id} stage={stage} pipelineId={pipeline.id} />
                      ))}
                    </div>
                    <AddStageForm pipelineId={pipeline.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={showCreate}
        onOpenChange={setShowCreate}
        title="Create Pipeline"
        description="A new pipeline with default stages will be created."
      >
        <form onSubmit={handleCreatePipeline} className="space-y-4">
          <Input
            label="Pipeline Name"
            placeholder="e.g., Enterprise Sales"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createPipeline.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function StageRow({ stage, pipelineId }: { stage: PipelineStage; pipelineId: string }) {
  const deleteStage = useDeleteStage(pipelineId);

  const stageTypeLabel = stage.stage_type === 'won' ? 'Won' : stage.stage_type === 'lost' ? 'Lost' : 'Active';
  const stageTypeBadge = stage.stage_type === 'won' ? 'success' : stage.stage_type === 'lost' ? 'danger' : 'default';

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group">
      <GripVertical className="h-4 w-4 text-zinc-300 cursor-grab" />
      <div
        className="h-3 w-3 rounded-full shrink-0"
        style={{ backgroundColor: stage.color ?? '#0891b2' }}
      />
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex-1">
        {stage.name}
      </span>
      <Badge variant={stageTypeBadge as any}>{stageTypeLabel}</Badge>
      <span className="text-xs text-zinc-400 w-12 text-right">{stage.probability_pct}%</span>
      {stage.rotting_days && (
        <span className="text-xs text-orange-500">{stage.rotting_days}d rot</span>
      )}
      <button
        onClick={() => deleteStage.mutate(stage.id)}
        className="opacity-0 group-hover:opacity-100 rounded p-1 text-zinc-400 hover:text-red-500 transition-all"
        title="Delete stage"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AddStageForm({ pipelineId }: { pipelineId: string }) {
  const [name, setName] = useState('');
  const [stageType, setStageType] = useState('active');
  const createStage = useCreateStage(pipelineId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createStage.mutateAsync({
      name: name.trim(),
      stage_type: stageType as 'active' | 'won' | 'lost',
    });
    setName('');
    setStageType('active');
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
      <div className="flex-1">
        <Input
          placeholder="New stage name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="w-32">
        <Select
          value={stageType}
          onValueChange={setStageType}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'won', label: 'Won' },
            { value: 'lost', label: 'Lost' },
          ]}
        />
      </div>
      <Button type="submit" size="sm" loading={createStage.isPending} disabled={!name.trim()}>
        Add
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom fields settings tab                                         */
/* ------------------------------------------------------------------ */

function FieldsSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Custom Fields</h3>
        <p className="text-sm text-zinc-500 mt-0.5">
          Define custom fields for contacts, companies, and deals.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-8 text-center">
        <FormInput className="h-8 w-8 text-zinc-300 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">
          Custom field configuration coming soon. Fields will be definable per entity type
          (contact, company, deal) with support for text, number, date, select, and multi-select types.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Lead scoring settings tab                                          */
/* ------------------------------------------------------------------ */

function ScoringSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Lead Scoring</h3>
        <p className="text-sm text-zinc-500 mt-0.5">
          Configure rules to automatically score contacts based on their attributes and behavior.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-8 text-center">
        <Star className="h-8 w-8 text-zinc-300 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">
          Lead scoring rule builder coming soon. Rules can match on lifecycle stage, lead source,
          custom fields, and activity history, with configurable point values.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings page container                                            */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: 'pipelines' as const, label: 'Pipelines', icon: Layers },
  { id: 'fields' as const, label: 'Custom Fields', icon: FormInput },
  { id: 'scoring' as const, label: 'Lead Scoring', icon: Star },
];

export function SettingsPage({ onNavigate, activeTab = 'pipelines' }: SettingsPageProps) {
  return (
    <div className="flex h-full">
      {/* Settings sidebar */}
      <div className="w-56 border-r border-zinc-100 dark:border-zinc-800 p-4 shrink-0">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 px-3 mb-3">
          Settings
        </h2>
        <nav className="space-y-0.5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(`/settings/${tab.id}`)}
                className={cn(
                  'flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Settings content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'pipelines' && <PipelinesSettings />}
        {activeTab === 'fields' && <FieldsSettings />}
        {activeTab === 'scoring' && <ScoringSettings />}
      </div>
    </div>
  );
}
