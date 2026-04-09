import {
  MessageSquare,
  Mail,
  Phone,
  Calendar as CalendarIcon,
  CheckSquare,
  ArrowRight,
  Trophy,
  XCircle,
  UserPlus,
  FileInput,
  Send,
  Eye,
  MousePointerClick,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/common/badge';
import { cn, formatRelativeTime } from '@/lib/utils';
import { type Activity, type ActivityType, activityTypeLabel, activityTypeColor } from '@/hooks/use-activities';
import type { LucideIcon } from 'lucide-react';

const typeIcons: Record<ActivityType, LucideIcon> = {
  note: MessageSquare,
  email_sent: Mail,
  email_received: Mail,
  call: Phone,
  meeting: CalendarIcon,
  task: CheckSquare,
  stage_change: ArrowRight,
  deal_created: Sparkles,
  deal_won: Trophy,
  deal_lost: XCircle,
  contact_created: UserPlus,
  form_submission: FileInput,
  campaign_sent: Send,
  campaign_opened: Eye,
  campaign_clicked: MousePointerClick,
  custom: Sparkles,
};

interface ActivityTimelineProps {
  activities: Activity[];
  isLoading?: boolean;
}

export function ActivityTimeline({ activities, isLoading }: ActivityTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-700 rounded" />
              <div className="h-3 w-32 bg-zinc-100 dark:bg-zinc-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-zinc-500">
        No activities yet
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-700" />

      <div className="space-y-4">
        {activities.map((activity) => {
          const Icon = typeIcons[activity.activity_type] ?? Sparkles;
          const color = activityTypeColor(activity.activity_type);

          return (
            <div key={activity.id} className="flex gap-3 relative">
              {/* Icon */}
              <div
                className="flex items-center justify-center h-8 w-8 rounded-full shrink-0 z-10"
                style={{ backgroundColor: `${color}20`, color }}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge color={color}>{activityTypeLabel(activity.activity_type)}</Badge>
                  {activity.subject && (
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {activity.subject}
                    </span>
                  )}
                </div>

                {activity.body && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                    {activity.body}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                  {activity.performed_by_name && (
                    <span>{activity.performed_by_name}</span>
                  )}
                  <span>{formatRelativeTime(activity.performed_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
