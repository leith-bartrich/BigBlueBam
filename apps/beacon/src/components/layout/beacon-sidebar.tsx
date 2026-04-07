import { Home, List, Search, GitBranch, BarChart3, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeaconSidebarProps {
  onNavigate: (path: string) => void;
  activePage: string;
}

const navItems = [
  { label: 'Home', icon: Home, path: '/' },
  { label: 'Browse', icon: List, path: '/list' },
  { label: 'Search', icon: Search, path: '/search' },
  { label: 'Graph', icon: GitBranch, path: '/graph' },
  { label: 'Dashboard', icon: BarChart3, path: '/dashboard' },
  { label: 'Settings', icon: Settings, path: '/settings' },
];

export function BeaconSidebar({ onNavigate, activePage }: BeaconSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo area */}
      <div className="flex items-center gap-2 px-4 h-14 shrink-0">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary-600 text-white font-bold text-sm">
          B
        </div>
        <span className="text-sm font-semibold text-white">Beacon</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isActive = activePage === item.label.toLowerCase() ||
            (item.path === '/' && activePage === 'home');
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={cn(
                'flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-active text-white'
                  : 'text-zinc-400 hover:bg-sidebar-hover hover:text-zinc-200',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
