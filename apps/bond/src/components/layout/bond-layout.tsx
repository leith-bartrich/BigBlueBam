import { useState, type ReactNode } from 'react';
import { ChevronRight, Bell, LogOut } from 'lucide-react';
import { Launchpad, LaunchpadTrigger } from '@bigbluebam/ui/launchpad';
import { BondSidebar } from '@/components/layout/bond-sidebar';
import { OrgSwitcher } from '@/components/layout/org-switcher';
import { Avatar } from '@/components/common/avatar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/common/dropdown-menu';
import { useAuthStore } from '@/stores/auth.store';

type ActiveRoute = { page: string; id?: string };

interface BondLayoutProps {
  children: ReactNode;
  onNavigate: (path: string) => void;
  activeRoute: ActiveRoute;
}

type Crumb = { label: string; href?: string };

function breadcrumbsFor(route: ActiveRoute): Crumb[] {
  switch (route.page) {
    case 'pipeline':
      return [{ label: 'Pipeline Board' }];
    case 'pipeline-detail':
      return [
        { label: 'Pipeline Board', href: '/' },
        { label: 'Pipeline' },
      ];
    case 'deal-detail':
      return [
        { label: 'Pipeline Board', href: '/' },
        { label: 'Deal' },
      ];
    case 'contacts':
      return [{ label: 'Contacts' }];
    case 'contact-detail':
      return [
        { label: 'Contacts', href: '/contacts' },
        { label: 'Contact' },
      ];
    case 'companies':
      return [{ label: 'Companies' }];
    case 'company-detail':
      return [
        { label: 'Companies', href: '/companies' },
        { label: 'Company' },
      ];
    case 'analytics':
      return [{ label: 'Analytics' }];
    case 'settings':
      return [{ label: 'Settings' }];
    default:
      return [];
  }
}

export function BondLayout({ children, onNavigate, activeRoute }: BondLayoutProps) {
  const user = useAuthStore((s) => s.user);
  const crumbs = breadcrumbsFor(activeRoute);
  const [launchpadOpen, setLaunchpadOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/b3/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
    window.location.href = '/b3/';
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[260px] flex-shrink-0 bg-sidebar flex flex-col">
          <BondSidebar onNavigate={onNavigate} activePage={activeRoute.page} />
        </aside>

        {/* Main column */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between h-14 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
            <div className="flex items-center gap-4">
              {/* Launchpad app switcher */}
              <nav className="flex items-center border-r border-zinc-200 dark:border-zinc-700 pr-4 mr-2">
                <LaunchpadTrigger onClick={() => setLaunchpadOpen(true)} />
              </nav>

              {/* Breadcrumbs */}
              <div className="flex items-center gap-1 text-sm">
                {crumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />}
                    {crumb.href ? (
                      <button
                        onClick={() => crumb.href && onNavigate(crumb.href!)}
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
            </div>

            <div className="flex items-center gap-4">
              <OrgSwitcher />

              <button
                className="relative rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
                title="Notifications"
              >
                <Bell className="h-4.5 w-4.5" />
              </button>

              <DropdownMenu
                trigger={
                  <button
                    className="flex items-center gap-2 rounded-lg p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    aria-label="User menu"
                  >
                    <Avatar src={user?.avatar_url} name={user?.display_name} size="sm" />
                  </button>
                }
              >
                <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{user?.display_name}</p>
                  <p className="text-xs text-zinc-500">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout} destructive>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenu>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-auto bg-white dark:bg-zinc-900">
            {children}
          </main>
        </div>
      </div>
      <Launchpad isOpen={launchpadOpen} onClose={() => setLaunchpadOpen(false)} currentApp="bond" />
    </div>
  );
}
