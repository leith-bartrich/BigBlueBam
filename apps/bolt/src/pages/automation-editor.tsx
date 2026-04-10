import { useState, useEffect } from 'react';
import { Loader2, Zap, Play, Save, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useAutomation,
  useCreateAutomation,
  useUpdateAutomation,
  useTestAutomation,
  type TriggerSource,
  type BoltCondition,
  type BoltAction,
} from '@/hooks/use-automations';
import { useProjectStore } from '@/stores/project.store';
import { TriggerSelector } from '@/components/builder/trigger-selector';
import { ConditionList } from '@/components/builder/condition-list';
import { ActionList } from '@/components/builder/action-list';
import { CronEditor } from '@/components/builder/cron-editor';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';

interface AutomationEditorPageProps {
  id?: string;
  onNavigate: (path: string) => void;
}

export function AutomationEditorPage({ id, onNavigate }: AutomationEditorPageProps) {
  const isNew = !id;
  const projectId = useProjectStore((s) => s.activeProjectId);

  const { data: existing, isLoading } = useAutomation(id);
  const createMutation = useCreateAutomation();
  const updateMutation = useUpdateAutomation();
  const testMutation = useTestAutomation();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [triggerSource, setTriggerSource] = useState<TriggerSource | undefined>(undefined);
  const [triggerEvent, setTriggerEvent] = useState('');
  const [triggerFilter, setTriggerFilter] = useState<Record<string, unknown>>({});
  const [cronExpression, setCronExpression] = useState('');
  const [conditions, setConditions] = useState<BoltCondition[]>([]);
  const [actions, setActions] = useState<BoltAction[]>([]);
  const [maxExecutionsPerHour, setMaxExecutionsPerHour] = useState(60);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showFilterEditor, setShowFilterEditor] = useState(false);

  // Populate from existing automation
  useEffect(() => {
    if (existing?.data) {
      const a = existing.data;
      setName(a.name);
      setDescription(a.description ?? '');
      setEnabled(a.enabled);
      setTriggerSource(a.trigger_source);
      setTriggerEvent(a.trigger_event);
      setTriggerFilter(a.trigger_filter ?? {});
      setCronExpression(a.cron_expression ?? '');
      setConditions(a.conditions);
      setActions(a.actions);
      setMaxExecutionsPerHour(a.max_executions_per_hour);
      setCooldownSeconds(a.cooldown_seconds);
    }
  }, [existing]);

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  const handleSave = async (enableOnSave = false) => {
    const payload = {
      name,
      description: description || null,
      enabled: enableOnSave ? true : enabled,
      trigger_source: triggerSource!,
      trigger_event: triggerEvent,
      trigger_filter: Object.keys(triggerFilter).length > 0 ? triggerFilter : null,
      cron_expression: cronExpression || null,
      conditions,
      actions,
      max_executions_per_hour: maxExecutionsPerHour,
      cooldown_seconds: cooldownSeconds,
      project_id: projectId,
    };

    if (isNew) {
      const result = await createMutation.mutateAsync(payload);
      onNavigate(`/automations/${result.data.id}`);
    } else {
      await updateMutation.mutateAsync({ id: id!, ...payload });
    }
  };

  const handleTest = async () => {
    if (id) {
      await testMutation.mutateAsync(id);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Filter key-value pairs
  const filterEntries = Object.entries(triggerFilter);
  const addFilterPair = () => setTriggerFilter({ ...triggerFilter, '': '' });
  const updateFilterKey = (oldKey: string, newKey: string) => {
    const entries = Object.entries(triggerFilter);
    const newFilter: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      newFilter[k === oldKey ? newKey : k] = v;
    }
    setTriggerFilter(newFilter);
  };
  const updateFilterValue = (key: string, value: string) => {
    setTriggerFilter({ ...triggerFilter, [key]: value });
  };
  const removeFilterPair = (key: string) => {
    const next = { ...triggerFilter };
    delete next[key];
    setTriggerFilter(next);
  };

  return (
    <div className="flex h-full">
      {/* Main editor area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Title */}
          <div>
            <input
              type="text"
              placeholder="Automation name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-2xl font-bold text-zinc-900 dark:text-zinc-100 bg-transparent border-none outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
            />
            <input
              type="text"
              placeholder="Add a description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm text-zinc-500 bg-transparent border-none outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-600 mt-1"
            />
          </div>

          {/* WHEN section (blue) */}
          <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800/50 overflow-hidden">
            <div className="bg-blue-50 dark:bg-blue-900/20 px-5 py-3 border-b border-blue-200 dark:border-blue-800/50">
              <h2 className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                WHEN — Trigger
              </h2>
              <p className="text-xs text-blue-500 dark:text-blue-400/70 mt-0.5">
                Define what event starts this automation.
              </p>
            </div>
            <div className="p-5 bg-white dark:bg-zinc-900 space-y-4">
              <TriggerSelector
                source={triggerSource}
                eventType={triggerEvent}
                onSourceChange={setTriggerSource}
                onEventTypeChange={setTriggerEvent}
              />

              {/* Cron expression for schedule triggers */}
              {triggerSource === 'schedule' && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Schedule</label>
                  <CronEditor
                    value={cronExpression}
                    onChange={setCronExpression}
                  />
                </div>
              )}

              {/* Optional filter */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowFilterEditor(!showFilterEditor)}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  {showFilterEditor ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {filterEntries.length > 0
                    ? `Filter (${filterEntries.length} ${filterEntries.length === 1 ? 'rule' : 'rules'})`
                    : 'Add trigger filter'}
                </button>

                {showFilterEditor && (
                  <div className="mt-2 space-y-2">
                    {filterEntries.map(([key, value], i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="key"
                          value={key}
                          onChange={(e) => updateFilterKey(key, e.target.value)}
                          className="w-40 shrink-0 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                        />
                        <input
                          type="text"
                          placeholder="value"
                          value={String(value ?? '')}
                          onChange={(e) => updateFilterValue(key, e.target.value)}
                          className="flex-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700"
                        />
                        <button
                          type="button"
                          onClick={() => removeFilterPair(key)}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addFilterPair}
                      className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
                    >
                      + Add filter pair
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* IF section (amber) */}
          <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800/50 overflow-hidden">
            <div className="bg-amber-50 dark:bg-amber-900/20 px-5 py-3 border-b border-amber-200 dark:border-amber-800/50">
              <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                IF — Conditions
                <span className="text-xs font-normal text-amber-500">(optional)</span>
              </h2>
              <p className="text-xs text-amber-500 dark:text-amber-400/70 mt-0.5">
                Only run actions when these conditions are met.
              </p>
            </div>
            <div className="p-5 bg-white dark:bg-zinc-900">
              <ConditionList conditions={conditions} onChange={setConditions} triggerSource={triggerSource} triggerEvent={triggerEvent} />
            </div>
          </div>

          {/* THEN section (green) */}
          <div className="rounded-xl border-2 border-green-200 dark:border-green-800/50 overflow-hidden">
            <div className="bg-green-50 dark:bg-green-900/20 px-5 py-3 border-b border-green-200 dark:border-green-800/50">
              <h2 className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                <Play className="h-4 w-4" />
                THEN — Actions
              </h2>
              <p className="text-xs text-green-500 dark:text-green-400/70 mt-0.5">
                Define the MCP tools to execute in order.
              </p>
            </div>
            <div className="p-5 bg-white dark:bg-zinc-900">
              <ActionList
                actions={actions}
                onChange={setActions}
                triggerSource={triggerSource}
                triggerEvent={triggerEvent}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Settings sidebar */}
      <div className="w-72 shrink-0 border-l border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 overflow-y-auto">
        <div className="p-5 space-y-5">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Settings</h3>

          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-700 dark:text-zinc-300">Enabled</label>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Rate limits */}
          <div className="space-y-3">
            <Input
              label="Max Executions / Hour"
              type="number"
              min={1}
              max={1000}
              value={maxExecutionsPerHour}
              onChange={(e) => setMaxExecutionsPerHour(Number(e.target.value) || 60)}
            />
            <Input
              label="Cooldown (seconds)"
              type="number"
              min={0}
              max={3600}
              value={cooldownSeconds}
              onChange={(e) => setCooldownSeconds(Number(e.target.value) || 0)}
            />
          </div>

          {/* Summary */}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Summary</h4>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
              <p>Trigger: {triggerSource ? `${triggerSource} / ${triggerEvent || '(no event)'}` : 'Not configured'}</p>
              <p>Conditions: {conditions.length === 0 ? 'None (always run)' : `${conditions.length} rule(s)`}</p>
              <p>Actions: {actions.length === 0 ? 'None' : `${actions.length} step(s)`}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            {!isNew && (
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={handleTest}
                loading={testMutation.isPending}
                disabled={!id}
              >
                <Play className="h-4 w-4" />
                Test Run
              </Button>
            )}

            {testMutation.data && (
              <div className="text-xs p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
                Test execution started: {testMutation.data.data.execution_id.slice(0, 8)}...
              </div>
            )}

            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => handleSave(false)}
              loading={isSaving}
              disabled={!name || !triggerSource || !triggerEvent}
            >
              <Save className="h-4 w-4" />
              Save Draft
            </Button>

            <Button
              size="sm"
              className="w-full"
              onClick={() => handleSave(true)}
              loading={isSaving}
              disabled={!name || !triggerSource || !triggerEvent || actions.length === 0}
            >
              <Zap className="h-4 w-4" />
              Save & Enable
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
