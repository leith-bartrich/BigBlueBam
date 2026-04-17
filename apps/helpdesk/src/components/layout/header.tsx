import { useAuthStore } from '@/stores/auth.store';
import { useTenantStore } from '@/stores/tenant.store';
import { generateAvatarInitials } from '@/lib/utils';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogOut, User, LifeBuoy } from 'lucide-react';

interface HeaderProps {
  onNavigate: (path: string) => void;
}

export function Header({ onNavigate }: HeaderProps) {
  const { user, logout } = useAuthStore();
  const { orgName, projectName } = useTenantStore();

  const handleLogout = async () => {
    await logout();
    onNavigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Left: Logo */}
        <button
          onClick={() => onNavigate('/tickets')}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary-600 text-white font-bold text-sm">
            B
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {orgName ?? 'BigBlueBam'}
            </span>
            <LifeBuoy className="h-3.5 w-3.5 text-primary-500" />
            <span className="text-sm text-zinc-500">
              {projectName ? `${projectName} support` : 'Helpdesk'}
            </span>
          </div>
        </button>

        {/* Center: Navigation */}
        <nav>
          <button
            onClick={() => onNavigate('/tickets')}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
          >
            My Tickets
          </button>
        </nav>

        {/* Right: User menu */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold dark:bg-primary-900 dark:text-primary-300">
                {generateAvatarInitials(user?.display_name)}
              </div>
              <span className="text-sm text-zinc-700 dark:text-zinc-300 hidden sm:inline">
                {user?.display_name}
              </span>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="min-w-[200px] bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 p-1.5 animate-fade-in z-50"
            >
              <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{user?.display_name}</p>
                <p className="text-xs text-zinc-500">{user?.email}</p>
              </div>

              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 rounded-lg cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 outline-none"
                disabled
              >
                <User className="h-4 w-4" />
                Profile
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="h-px bg-zinc-100 dark:bg-zinc-800 my-1" />

              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 rounded-lg cursor-pointer hover:bg-red-50 dark:hover:bg-red-950 outline-none"
                onSelect={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
