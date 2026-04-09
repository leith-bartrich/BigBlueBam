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
  Handshake,
  Mail,
  BarChart3,
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
  { id: 'bond', name: 'Bond', description: 'CRM', icon: Handshake, color: '#0891b2', path: '/bond/' },
  { id: 'blast', name: 'Blast', description: 'Email Campaigns', icon: Mail, color: '#dc2626', path: '/blast/' },
  { id: 'bench', name: 'Bench', description: 'Analytics', icon: BarChart3, color: '#2563eb', path: '/bench/' },
  { id: 'brief', name: 'Brief', description: 'Documents', icon: FileText, color: '#d97706', path: '/brief/' },
  { id: 'bolt', name: 'Bolt', description: 'Automations', icon: Zap, color: '#dc2626', path: '/bolt/' },
  { id: 'bearing', name: 'Bearing', description: 'Goals & OKRs', icon: Target, color: '#0d9488', path: '/bearing/' },
  { id: 'board', name: 'Board', description: 'Whiteboards', icon: PenTool, color: '#6366f1', path: '/board/' },
  { id: 'helpdesk', name: 'Helpdesk', description: 'Customer Support', icon: Headset, color: '#be123c', path: '/helpdesk/' },
  { id: 'mcp', name: 'MCP Server', description: 'AI Tools', icon: Bot, color: '#64748b', path: '/mcp/' },
];

/* ------------------------------------------------------------------ */
/*  Launchpad trigger button                                          */
/* ------------------------------------------------------------------ */

export { LayoutGrid };

interface LaunchpadTriggerProps {
  onClick: () => void;
}

export const LaunchpadTrigger: FC<LaunchpadTriggerProps> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center justify-center h-8 w-8 rounded-lg text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    aria-label="Open launchpad"
  >
    <LayoutGrid className="h-5 w-5" />
  </button>
);

/* ------------------------------------------------------------------ */
/*  Launchpad overlay                                                 */
/* ------------------------------------------------------------------ */

interface LaunchpadProps {
  isOpen: boolean;
  onClose: () => void;
  currentApp: string;
}

export function Launchpad({ isOpen, onClose, currentApp }: LaunchpadProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        ref={ref}
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl p-6 animate-[fade-in_0.15s_ease-out]"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-100">BigBlueBam Suite</h2>
        <div className="grid grid-cols-4 gap-3">
          {APPS.map((app) => {
            const Icon = app.icon;
            const isCurrent = app.id === currentApp;
            return (
              <a
                key={app.id}
                href={app.path}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-colors ${
                  isCurrent
                    ? 'bg-primary-50 dark:bg-primary-950/30 ring-2 ring-primary-500'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div
                  className="flex items-center justify-center h-10 w-10 rounded-xl text-white"
                  style={{ backgroundColor: app.color }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{app.name}</div>
                  <div className="text-[10px] text-zinc-500">{app.description}</div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
