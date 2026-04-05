import { useState } from 'react';
import { Calendar, Plus, Play, X, Trash2, BarChart3 } from 'lucide-react';
import type { Sprint } from '@bigbluebam/shared';
import { Select } from '@/components/common/select';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';
import { DatePicker } from '@/components/common/date-picker';
import { useCreateSprint, useStartSprint, useDeleteSprint } from '@/hooks/use-sprints';
import { formatDate } from '@/lib/utils';

interface SprintSelectorProps {
  sprints: Sprint[];
  activeSprint?: Sprint | null;
  selectedSprintId?: string;
  onSelectSprint: (sprintId: string) => void;
  projectId: string;
  onNavigate?: (path: string) => void;
}

export function SprintSelector({ sprints, activeSprint, selectedSprintId, onSelectSprint, projectId, onNavigate }: SprintSelectorProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');

  const createSprint = useCreateSprint();
  const startSprint = useStartSprint();
  const deleteSprint = useDeleteSprint();

  const options = sprints.map((s) => ({
    value: s.id,
    label: `${s.name}${s.status === 'active' ? ' (Active)' : s.status === 'completed' ? ' (Done)' : ''}`,
  }));

  const selected = sprints.find((s) => s.id === selectedSprintId) ?? activeSprint;

  const handleCreate = async () => {
    if (!name.trim() || !startDate || !endDate) return;
    const result = await createSprint.mutateAsync({
      projectId,
      data: {
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        goal: goal.trim() || undefined,
      },
    });
    if (result?.data?.id) {
      onSelectSprint(result.data.id);
    }
    setName('');
    setStartDate('');
    setEndDate('');
    setGoal('');
    setShowCreateForm(false);
  };

  const handleStartSprint = () => {
    if (!selected) return;
    startSprint.mutate({ sprintId: selected.id, projectId });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {options.length > 0 ? (
          <Select
            options={options}
            value={selectedSprintId ?? activeSprint?.id}
            onValueChange={onSelectSprint}
            placeholder="Select sprint..."
            className="w-52"
          />
        ) : (
          <span className="text-sm text-zinc-400 italic">No sprints yet</span>
        )}

        {selected && selected.status === 'planned' && (
          <>
            <Button
              size="sm"
              variant="primary"
              onClick={handleStartSprint}
              loading={startSprint.isPending}
              title="Start this sprint"
            >
              <Play className="h-3.5 w-3.5" />
              Start
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete sprint "${selected.name}"? Tasks in this sprint will be unassigned from it.`)) {
                  deleteSprint.mutate({ projectId, sprintId: selected.id });
                }
              }}
              loading={deleteSprint.isPending}
              title="Delete this sprint"
              aria-label="Delete this sprint"
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowCreateForm((v) => !v)}
          title={showCreateForm ? 'Cancel' : 'Create sprint'}
          aria-label={showCreateForm ? 'Cancel create sprint' : 'Create sprint'}
          aria-expanded={showCreateForm}
        >
          {showCreateForm ? <X className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        </Button>

        {selected && (
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(selected.start_date)} - {formatDate(selected.end_date)}
            </span>
            {onNavigate && (
              <button
                onClick={() => onNavigate(`/projects/${projectId}/sprints/${selected.id}/report`)}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
                title="View sprint report"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                View Report
              </button>
            )}
          </div>
        )}
      </div>

      {selected?.goal && (
        <p className="text-xs text-zinc-400 italic max-w-md truncate pl-1" title={selected.goal}>
          Goal: {selected.goal}
        </p>
      )}

      {showCreateForm && (
        <div className="flex items-end gap-2 p-3 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
          <Input
            id="sprint-name"
            label="Name"
            placeholder="Sprint 1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-36"
          />
          <DatePicker
            label="Start"
            value={startDate}
            onChange={(val) => setStartDate(val)}
          />
          <DatePicker
            label="End"
            value={endDate}
            onChange={(val) => setEndDate(val)}
          />
          <Input
            id="sprint-goal"
            label="Goal"
            placeholder="Optional goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="w-44"
          />
          <Button
            size="sm"
            onClick={handleCreate}
            loading={createSprint.isPending}
            disabled={!name.trim() || !startDate || !endDate}
          >
            Create
          </Button>
        </div>
      )}
    </div>
  );
}
