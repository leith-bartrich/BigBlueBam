import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DollarSign, Calendar, Clock, Building2 } from 'lucide-react';
import { Avatar } from '@/components/common/avatar';
import { cn, formatCurrencyCompact, formatDate, daysInStage } from '@/lib/utils';
import type { Deal } from '@/hooks/use-deals';

interface DealCardProps {
  deal: Deal;
  rottingDays?: number | null;
  onOpen: (dealId: string) => void;
}

export function DealCard({ deal, rottingDays, onOpen }: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id, data: { type: 'deal', deal } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const days = daysInStage(deal.stage_entered_at);
  const isRotting = rottingDays != null && days > rottingDays;
  const isSevereRotting = rottingDays != null && days > rottingDays * 1.5;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(deal.id)}
      className={cn(
        'group relative rounded-lg border border-zinc-200 bg-white p-3 cursor-pointer',
        'hover:shadow-md hover:border-zinc-300 transition-all duration-150',
        'dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-600',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary-400',
        isRotting && !isSevereRotting && 'deal-rotting',
        isSevereRotting && 'deal-rotting-severe',
      )}
      role="button"
      tabIndex={0}
    >
      {/* Deal name */}
      <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2 line-clamp-2">
        {deal.name}
      </h4>

      {/* Company */}
      {deal.company_name && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mb-2">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{deal.company_name}</span>
        </div>
      )}

      {/* Value */}
      {deal.value != null && (
        <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          <DollarSign className="h-3.5 w-3.5 text-green-600" />
          {formatCurrencyCompact(deal.value, deal.currency)}
        </div>
      )}

      {/* Bottom row: close date, days in stage, owner */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          {deal.expected_close_date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(deal.expected_close_date)}
            </span>
          )}
          <span
            className={cn(
              'flex items-center gap-1',
              isRotting && 'text-orange-500 font-medium',
              isSevereRotting && 'text-red-500 font-medium',
            )}
          >
            <Clock className="h-3 w-3" />
            {days}d
          </span>
        </div>
        {deal.owner_name && (
          <Avatar src={deal.owner_avatar_url} name={deal.owner_name} size="sm" />
        )}
      </div>
    </div>
  );
}
