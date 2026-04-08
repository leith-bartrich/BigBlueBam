import { type ReactNode } from 'react';
import { ChevronRight, Search, Bell, LogOut } from 'lucide-react';
import { BeaconSidebar } from '@/components/layout/beacon-sidebar';
import { OrgSwitcher } from '@/components/layout/org-switcher';
import { Avatar } from '@/components/common/avatar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/common/dropdown-menu';
import { useAuthStore } from '@/stores/auth.store';
import { useProjectStore } from '@/stores/project.store';
import { useProjectName } from '@/hooks/use-projects';

type ActiveRoute = { page: string; idOrSlug?: string; focalId?: string };

interface BeaconLayoutProps {
  children: ReactNode;
  onNavigate: (path: string) => void;
  activeRoute: ActiveRoute;
}

type Crumb = { label: string; href?: string };

function breadcrumbsFor(route: ActiveRoute): Crumb[] {
  switch (route.page) {
    case 'home':
      return [{ label: 'Knowledge Home' }];
    case 'list':
      return [{ label: 'Browse Beacons' }];
    case 'search':
      return [{ label: 'Search' }];
    case 'detail':
      return [
        { label: 'Browse', href: '/list' },
        { label: route.idOrSlug ?? 'Beacon' },
      ];
    case 'create':
      return [{ label: 'Create Beacon' }];
    case 'edit':
      return [
        { label: 'Browse', href: '/list' },
        { label: route.idOrSlug ?? 'Beacon', href: `/${route.idOrSlug}` },
        { label: 'Edit' },
      ];
    case 'graph':
      return [{ label: 'Knowledge Graph' }];
    case 'dashboard':
      return [{ label: 'Dashboard' }];
    case 'settings':
      return [{ label: 'Settings' }];
    default:
      return [];
  }
}

export function BeaconLayout({ children, onNavigate, activeRoute }: BeaconLayoutProps) {
  const user = useAuthStore((s) => s.user);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProjectName = useProjectName(activeProjectId);

  const crumbs = breadcrumbsFor(activeRoute);

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
          <BeaconSidebar onNavigate={onNavigate} activePage={activeRoute.page} />
        </aside>

        {/* Main column */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between h-14 px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
            <div className="flex items-center gap-4">
              {/* Cross-app pills */}
              <nav className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-700 pr-4 mr-2">
                <button
                  onClick={() => { window.location.href = '/b3/'; }}
                  className="px-2 py-1 text-xs font-medium rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
                  title="BigBlueBam"
                >
                  Bam
                </button>
                <button
                  onClick={() => { window.location.href = '/banter/'; }}
                  className="px-2 py-1 text-xs font-medium rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
                  title="Banter"
                >
                  Banter
                </button>
                <button
                  onClick={() => onNavigate('/')}
                  className="relative px-2 py-1 text-xs font-medium rounded-md bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                  title="Beacon"
                >
                  Beacon
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary-500" />
                </button>
                <button
                  onClick={() => { window.location.href = '/brief/'; }}
                  className="px-2 py-1 text-xs font-medium rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
                  title="Brief"
                >
                  Brief
                </button>
                <button
                  onClick={() => { window.location.href = '/bolt/'; }}
                  className="px-2 py-1 text-xs font-medium rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
                  title="Bolt"
                >
                  Bolt
                </button>
                <button
                  onClick={() => { window.location.href = '/bearing/'; }}
                  className="px-2 py-1 text-xs font-medium rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
                  title="Bearing"
                >
                  Bearing
                </button>
                <button
                  onClick={() => { window.location.href = '/helpdesk/'; }}
                  className="px-2 py-1 text-xs font-medium rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors"
                  title="Helpdesk"
                >
                  Helpdesk
                </button>
              </nav>

              {/* Breadcrumbs */}
              <div className="flex items-center gap-1 text-sm">
                {activeProjectName && (
                  <>
                    <span className="text-zinc-500 dark:text-zinc-400">{activeProjectName}</span>
                    {crumbs.length > 0 && <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />}
                  </>
                )}
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search knowledge base..."
                  className="w-64 rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                />
              </div>

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
                <DropdownMenuItem onSelect={() => onNavigate('/settings')}>Settings</DropdownMenuItem>
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
    </div>
  );
}
