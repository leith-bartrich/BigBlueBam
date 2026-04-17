import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { DealCard } from '@/components/pipeline/deal-card';
import { cn, formatCurrencyCompact } from '@/lib/utils';
import type { Deal } from '@/hooks/use-deals';
import type { PipelineStage } from '@/hooks/use-pipelines';

export interface SwimlaneGroup {
  key: string;
  label: string;
  deals: Deal[];
}

interface StageColumnProps {
  stage: PipelineStage;
  deals: Deal[];
  /** When provided, deals are rendered per-lane with a lane header. Takes
   *  precedence over the flat `deals` list for rendering, but `deals` is
   *  still used to compute the stage total/count. */
  swimlanes?: SwimlaneGroup[] | null;
  onOpenDeal: (dealId: string) => void;
  onAddDeal: (stageId: string) => void;
}

export function StageColumn({ stage, deals, swimlanes, onOpenDeal, onAddDeal }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const totalValue = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const dealCount = deals.length;

  const stageColor = stage.color ?? (
    stage.stage_type === 'won' ? '#16a34a' :
    stage.stage_type === 'lost' ? '#dc2626' : '#0891b2'
  );

  const hasLanes = !!swimlanes && swimlanes.length > 0;

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
          'flex-1 px-2 pb-4 min-h-[120px] rounded-lg transition-colors',
          !hasLanes && 'space-y-2',
          isOver && 'bg-primary-50/50 dark:bg-primary-950/30 ring-2 ring-primary-300 dark:ring-primary-700',
        )}
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {hasLanes ? (
            <div className="space-y-3">
              {swimlanes!.map((lane) => (
                <div key={lane.key}>
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                      {lane.label}
                    </span>
                    <span className="text-[11px] text-zinc-400 tabular-nums">
                      {lane.deals.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {lane.deals.length === 0 ? (
                      <div className="text-xs text-zinc-300 dark:text-zinc-600 italic px-1 py-2">
                        (empty)
                      </div>
                    ) : (
                      lane.deals.map((deal) => (
                        <DealCard
                          key={deal.id}
                          deal={deal}
                          rottingDays={stage.rotting_days}
                          onOpen={onOpenDeal}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                rottingDays={stage.rotting_days}
                onOpen={onOpenDeal}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
