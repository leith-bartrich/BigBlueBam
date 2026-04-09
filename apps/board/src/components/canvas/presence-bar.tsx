import { Avatar } from '@/components/common/avatar';

interface Collaborator {
  id: string;
  name: string;
  avatar_url?: string | null;
  color: string;
}

interface PresenceBarProps {
  boardId: string;
  collaborators?: Collaborator[];
}

// Cursor colors assigned to collaborators
const CURSOR_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export function PresenceBar({ boardId: _boardId, collaborators = [] }: PresenceBarProps) {

  const MAX_SHOWN = 6;
  const shown = collaborators.slice(0, MAX_SHOWN);
  const overflow = collaborators.length - MAX_SHOWN;

  if (collaborators.length === 0) return null;

  return (
    <div className="absolute top-14 right-3 z-[200] flex items-center gap-1 rounded-lg bg-white/90 dark:bg-zinc-800/90 backdrop-blur shadow-sm border border-zinc-200 dark:border-zinc-700 px-2 py-1.5">
      {shown.map((c, idx) => (
        <div key={c.id} title={c.name} className="relative group">
          <Avatar
            src={c.avatar_url}
            name={c.name}
            size="sm"
            borderColor={c.color ?? CURSOR_COLORS[idx % CURSOR_COLORS.length]}
          />
          {/* Tooltip on hover */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:block z-10">
            <div className="rounded bg-zinc-900 text-white text-[10px] px-2 py-1 whitespace-nowrap shadow-lg">
              {c.name}
            </div>
          </div>
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-700 text-[10px] font-medium text-zinc-600 dark:text-zinc-300">
          +{overflow}
        </div>
      )}
    </div>
  );
}

export { CURSOR_COLORS };
