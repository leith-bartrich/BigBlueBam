import { useState } from 'react';
import { Plus, Target, Loader2, Search } from 'lucide-react';
import { PeriodSelector } from '@/components/dashboard/PeriodSelector';
import { ProgressSummary } from '@/components/dashboard/ProgressSummary';
import { ScopeFilter } from '@/components/dashboard/ScopeFilter';
import { GoalGrid } from '@/components/dashboard/GoalGrid';
import { Button } from '@/components/common/button';
import { Dialog } from '@/components/common/dialog';
import { Input } from '@/components/common/input';
import { useGoals, useCreateGoal, type GoalScope } from '@/hooks/useGoals';
import { usePeriodStore } from '@/stores/period.store';
import { useAuthStore } from '@/stores/auth.store';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

type ScopeTab = 'all' | GoalScope;

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [scopeFilter, setScopeFilter] = useState<ScopeTab>('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const selectedPeriodId = usePeriodStore((s) => s.selectedPeriodId);

  const { data, isLoading } = useGoals({
    scope: scopeFilter === 'all' ? undefined : scopeFilter,
    search: search || undefined,
  });

  const goals = data?.data ?? [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Goals Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">Track objectives and key results across your organization.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Goal
        </Button>
      </div>

      {/* Period selector */}
      <PeriodSelector />

      {/* Stats */}
      <ProgressSummary periodId={selectedPeriodId ?? undefined} />

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <ScopeFilter active={scopeFilter} onChange={setScopeFilter} />

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search goals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
          />
        </div>
      </div>

      {/* Goal grid */}
      {!selectedPeriodId ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <Target className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Select a period</p>
          <p className="text-sm mt-1">Choose a period from the selector above to view goals.</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <Target className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No goals found</p>
          <p className="text-sm mt-1">Create your first goal to get started.</p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create First Goal
          </Button>
        </div>
      ) : (
        <GoalGrid goals={goals} onNavigate={onNavigate} groupByScope={scopeFilter === 'all'} />
      )}

      {/* Create goal dialog */}
      <CreateGoalDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onNavigate={onNavigate}
      />
    </div>
  );
}

// ── Create Goal Dialog ──

function CreateGoalDialog({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<GoalScope>('team');
  const selectedPeriodId = usePeriodStore((s) => s.selectedPeriodId);
  const userId = useAuthStore((s) => s.user?.id);
  const createMutation = useCreateGoal();

  const handleSubmit = () => {
    if (!title.trim() || !selectedPeriodId || !userId) return;
    createMutation.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        scope,
        period_id: selectedPeriodId,
        owner_id: userId,
      },
      {
        onSuccess: (response) => {
          setTitle('');
          setDescription('');
          setScope('team');
          onOpenChange(false);
          onNavigate(`/goals/${response.data.id}`);
        },
      },
    );
  };

  const scopes: Array<{ value: GoalScope; label: string }> = [
    { value: 'organization', label: 'Organization' },
    { value: 'team', label: 'Team' },
    { value: 'project', label: 'Project' },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create Goal"
      description="Set a new objective for this period."
    >
      <div className="space-y-4">
        <Input
          label="Title"
          placeholder="e.g., Increase customer retention by 15%"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Why is this goal important?"
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-zinc-100 placeholder:text-zinc-400 resize-y min-h-[80px]"
            rows={3}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Scope</label>
          <div className="flex gap-2">
            {scopes.map((s) => (
              <button
                key={s.value}
                onClick={() => setScope(s.value)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  scope === s.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} loading={createMutation.isPending} disabled={!title.trim() || !selectedPeriodId}>
            Create Goal
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
