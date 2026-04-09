import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Search, Filter, Plus } from 'lucide-react';
import { StageColumn } from '@/components/pipeline/stage-column';
import { DealCard } from '@/components/pipeline/deal-card';
import { CreateDealDialog } from '@/components/pipeline/create-deal-dialog';
import { Input } from '@/components/common/input';
import { Button } from '@/components/common/button';
import { usePipeline, type Pipeline } from '@/hooks/use-pipelines';
import { useDeals, useMoveDealStage, type Deal } from '@/hooks/use-deals';
import { usePipelineStore } from '@/stores/pipeline.store';
import { usePipelineSummary } from '@/hooks/use-analytics';
import { formatCurrencyCompact } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface PipelineBoardProps {
  onNavigate: (path: string) => void;
  pipelineId?: string;
}

export function PipelineBoard({ onNavigate, pipelineId: propPipelineId }: PipelineBoardProps) {
  const storePipelineId = usePipelineStore((s) => s.activePipelineId);
  const activePipelineId = propPipelineId ?? storePipelineId;

  const { data: pipelineData, isLoading: pipelineLoading } = usePipeline(activePipelineId);
  const pipeline = pipelineData?.data;

  const { data: dealsData, isLoading: dealsLoading } = useDeals({
    pipeline_id: activePipelineId ?? undefined,
  });
  const deals = dealsData?.data ?? [];

  const { data: summaryData } = usePipelineSummary(activePipelineId ?? undefined);
  const summary = summaryData?.data;

  const moveDealStage = useMoveDealStage();

  const [search, setSearch] = useState('');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createStageId, setCreateStageId] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const stages = useMemo(
    () => (pipeline?.stages ?? []).sort((a, b) => a.sort_order - b.sort_order),
    [pipeline?.stages],
  );

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const stage of stages) {
      map.set(stage.id, []);
    }
    for (const deal of deals) {
      const filtered = search
        ? deal.name.toLowerCase().includes(search.toLowerCase()) ||
          deal.company_name?.toLowerCase().includes(search.toLowerCase())
        : true;
      if (filtered) {
        const list = map.get(deal.stage_id);
        if (list) list.push(deal);
      }
    }
    return map;
  }, [deals, stages, search]);

  const activeDragDeal = activeDragId ? deals.find((d) => d.id === activeDragId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over) return;

      const dealId = active.id as string;
      const targetStageId = over.id as string;

      const deal = deals.find((d) => d.id === dealId);
      if (!deal || deal.stage_id === targetStageId) return;

      // Check if it's a valid stage
      const targetStage = stages.find((s) => s.id === targetStageId);
      if (!targetStage) return;

      moveDealStage.mutate({ dealId, stageId: targetStageId });
    },
    [deals, stages, moveDealStage],
  );

  const handleOpenDeal = useCallback(
    (dealId: string) => {
      onNavigate(`/deals/${dealId}`);
    },
    [onNavigate],
  );

  const handleAddDeal = useCallback((stageId: string) => {
    setCreateStageId(stageId);
    setCreateDialogOpen(true);
  }, []);

  if (pipelineLoading || dealsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          No pipeline selected
        </h2>
        <p className="text-sm text-zinc-500 mb-4">
          Select a pipeline from the sidebar or create your first one.
        </p>
        <Button onClick={() => onNavigate('/settings/pipelines')}>
          <Plus className="h-4 w-4" />
          Create Pipeline
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Board header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {pipeline.name}
          </h2>
          {summary && (
            <div className="flex items-center gap-3 text-sm text-zinc-500">
              <span>{summary.total_deals} deals</span>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <span>Total: {formatCurrencyCompact(summary.total_value)}</span>
              <span className="text-zinc-300 dark:text-zinc-600">|</span>
              <span>Weighted: {formatCurrencyCompact(summary.weighted_value)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search deals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleAddDeal(stages[0]?.id ?? '')}
            disabled={stages.length === 0}
          >
            <Plus className="h-4 w-4" />
            Add Deal
          </Button>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 h-full p-4 min-w-max">
            {stages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage.get(stage.id) ?? []}
                onOpenDeal={handleOpenDeal}
                onAddDeal={handleAddDeal}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDragDeal ? (
              <div className="w-[280px] opacity-90">
                <DealCard
                  deal={activeDragDeal}
                  onOpen={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Create deal dialog */}
      <CreateDealDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        pipelineId={pipeline.id}
        stageId={createStageId}
        onSuccess={(dealId) => onNavigate(`/deals/${dealId}`)}
      />
    </div>
  );
}
