import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { DealCard } from '@/components/pipeline/deal-card';
import { cn, formatCurrencyCompact } from '@/lib/utils';
import type { Deal } from '@/hooks/use-deals';
import type { PipelineStage } from '@/hooks/use-pipelines';

interface StageColumnProps {
  stage: PipelineStage;
  deals: Deal[];
  onOpenDeal: (dealId: string) => void;
  onAddDeal: (stageId: string) => void;
}

export function StageColumn({ stage, deals, onOpenDeal, onAddDeal }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const totalValue = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const dealCount = deals.length;

  const stageColor = stage.color ?? (
    stage.stage_type === 'won' ? '#16a34a' :
    stage.stage_type === 'lost' ? '#dc2626' : '#0891b2'
  );

  return (
    <div className="flex flex-col w-[300px] min-w-[300px] shrink-0">
      {/* Stage header */}
      <div className="flex items-center justify-between px-3 py-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: stageColor }} />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {stage.name}
          </h3>
          <span className="text-xs text-zinc-400 tabular-nums">{dealCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 tabular-nums">
            {formatCurrencyCompact(totalValue)}
          </span>
          <button
            onClick={() => onAddDeal(stage.id)}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
            title={`Add deal to ${stage.name}`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 px-2 pb-4 min-h-[120px] rounded-lg transition-colors',
          isOver && 'bg-primary-50/50 dark:bg-primary-950/30 ring-2 ring-primary-300 dark:ring-primary-700',
        )}
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              rottingDays={stage.rotting_days}
              onOpen={onOpenDeal}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
