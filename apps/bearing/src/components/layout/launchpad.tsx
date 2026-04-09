import { useEffect, useRef, useCallback, type FC } from 'react';
import {
  LayoutDashboard,
  MessageCircle,
  BookOpen,
  FileText,
  Zap,
  Target,
  PenTool,
  Headset,
  Bot,
  X,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';

interface AppDef {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  path: string;
}

const APPS: AppDef[] = [
  { id: 'b3', name: 'Bam', description: 'Project Management', icon: LayoutDashboard, color: '#2563eb', path: '/b3/' },
  { id: 'banter', name: 'Banter', description: 'Team Messaging', icon: MessageCircle, color: '#7c3aed', path: '/banter/' },
  { id: 'beacon', name: 'Beacon', description: 'Knowledge Base', icon: BookOpen, color: '#059669', path: '/beacon/' },
  { id: 'brief', name: 'Brief', description: 'Documents', icon: FileText, color: '#d97706', path: '/brief/' },
  { id: 'bolt', name: 'Bolt', description: 'Automations', icon: Zap, color: '#dc2626', path: '/bolt/' },
  { id: 'bearing', name: 'Bearing', description: 'Goals & OKRs', icon: Target, color: '#0891b2', path: '/bearing/' },
  { id: 'board', name: 'Board', description: 'Whiteboards', icon: PenTool, color: '#6366f1', path: '/board/' },
  { id: 'helpdesk', name: 'Helpdesk', description: 'Customer Support', icon: Headset, color: '#be123c', path: '/helpdesk/' },
  { id: 'mcp', name: 'MCP Server', description: 'AI Tools (182)', icon: Bot, color: '#64748b', path: '/mcp/' },
];

/* ------------------------------------------------------------------ */
/*  Launchpad trigger button                                          */
/* ------------------------------------------------------------------ */

export { LayoutGrid };

export function LaunchpadTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
      title="Launchpad — switch between apps"
    >
      <LayoutGrid className="h-4 w-4" />
      <span className="hidden sm:inline">Launchpad</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Launchpad overlay                                                  */
/* ------------------------------------------------------------------ */

interface LaunchpadProps {
  isOpen: boolean;
  onClose: () => void;
  currentApp?: string;
}

export const Launchpad: FC<LaunchpadProps> = ({ isOpen, onClose, currentApp }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Focus first tile when opened
  useEffect(() => {
    if (isOpen && gridRef.current) {
      const first = gridRef.current.querySelector<HTMLAnchorElement>('a');
      first?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Launchpad — switch between apps"
    >
      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            BigBlueBam Launchpad
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
            aria-label="Close launchpad"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Grid */}
        <div
          ref={gridRef}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-6"
          role="grid"
        >
          {APPS.map((app) => {
            const Icon = app.icon;
            const isCurrent = currentApp === app.id;
            return (
              <a
                key={app.id}
                href={app.path}
                className={`
                  group relative flex flex-col items-center gap-2 rounded-xl border px-4 py-5 text-center
                  transition-all duration-150 outline-none
                  focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500
                  ${
                    isCurrent
                      ? 'border-primary-300 bg-primary-50/60 shadow-sm ring-2 ring-primary-200 dark:border-primary-700 dark:bg-primary-950/40 dark:ring-primary-800'
                      : 'border-zinc-150 bg-zinc-50 hover:border-zinc-300 hover:bg-white hover:shadow-md hover:scale-[1.03] dark:border-zinc-800 dark:bg-zinc-850 dark:hover:border-zinc-600 dark:hover:bg-zinc-800'
                  }
                `}
                style={{ borderLeftColor: app.color, borderLeftWidth: '3px' }}
              >
                {isCurrent && (
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary-500 animate-pulse" />
                )}
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
                  style={{ backgroundColor: `${app.color}15`, color: app.color }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{app.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{app.description}</p>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* Inline keyframe animations — works without any tailwind config changes */}
      <style>{`
        @keyframes lp-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lp-scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: lp-fade-in 0.15s ease-out; }
        .animate-scale-in { animation: lp-scale-in 0.2s ease-out; }
      `}</style>
    </div>
  );
};
