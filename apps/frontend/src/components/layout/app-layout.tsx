import { useState, type ReactNode } from 'react';
import { Search, LogOut, ChevronRight } from 'lucide-react';
import { Sidebar } from './sidebar';
import { Avatar } from '@/components/common/avatar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/common/dropdown-menu';
import { useAuthStore } from '@/stores/auth.store';

interface AppLayoutProps {
  children: ReactNode;
  currentProjectId?: string;
  breadcrumbs?: { label: string; href?: string }[];
  onNavigate: (path: string) => void;
  onCreateProject: () => void;
}

export function AppLayout({ children, currentProjectId, breadcrumbs = [], onNavigate, onCreateProject }: AppLayoutProps) {
  const { user, logout } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = async () => {
    await logout();
    onNavigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <Sidebar
        currentProjectId={currentProjectId}
        onNavigate={onNavigate}
        onCreateProject={onCreateProject}
      />

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between h-14 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
          <div className="flex items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />}
                {crumb.href ? (
                  <button
                    onClick={() => crumb.href && onNavigate(crumb.href)}
                    className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-zinc-900 dark:text-zinc-100 font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
              />
            </div>

            <DropdownMenu
              trigger={
                <button className="flex items-center gap-2 rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  <Avatar src={user?.avatar_url} name={user?.display_name} size="sm" />
                </button>
              }
            >
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{user?.display_name}</p>
                <p className="text-xs text-zinc-500">{user?.email}</p>
              </div>
              <DropdownMenuItem onSelect={() => onNavigate('/settings')}>Settings</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout} destructive>
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
