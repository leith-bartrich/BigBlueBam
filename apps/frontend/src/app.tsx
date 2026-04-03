import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { DashboardPage } from '@/pages/dashboard';
import { BoardPage } from '@/pages/board';
import { SettingsPage } from '@/pages/settings';
import { MyWorkPage } from '@/pages/my-work';
import { ProjectDashboardPage } from '@/pages/project-dashboard';
import { AuditLogPage } from '@/pages/audit-log';
import { Loader2 } from 'lucide-react';

type Route =
  | { page: 'login' }
  | { page: 'register' }
  | { page: 'dashboard' }
  | { page: 'board'; projectId: string }
  | { page: 'project-dashboard'; projectId: string }
  | { page: 'audit-log'; projectId: string }
  | { page: 'settings' }
  | { page: 'my-work' };

function parseRoute(path: string): Route {
  const boardMatch = path.match(/^\/projects\/([^/]+)\/board$/);
  if (boardMatch) {
    return { page: 'board', projectId: boardMatch[1]! };
  }
  const dashboardMatch = path.match(/^\/projects\/([^/]+)\/dashboard$/);
  if (dashboardMatch) {
    return { page: 'project-dashboard', projectId: dashboardMatch[1]! };
  }
  const auditMatch = path.match(/^\/projects\/([^/]+)\/audit-log$/);
  if (auditMatch) {
    return { page: 'audit-log', projectId: auditMatch[1]! };
  }
  if (path === '/register') return { page: 'register' };
  if (path === '/login') return { page: 'login' };
  if (path === '/settings') return { page: 'settings' };
  if (path === '/my-work') return { page: 'my-work' };
  return { page: 'dashboard' };
}

export function App() {
  const { isAuthenticated, isLoading, fetchMe } = useAuthStore();
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    // Apply saved theme on mount
    const savedTheme = localStorage.getItem('bbam-theme') ?? 'system';
    const root = document.documentElement;
    root.classList.remove('dark'); // Start clean
    if (savedTheme === 'dark') {
      root.classList.add('dark');
    } else if (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    }
    // 'light' = no dark class (already removed above)
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseRoute(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((path: string) => {
    window.history.pushState(null, '', path);
    setRoute(parseRoute(path));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-600 text-white font-bold text-2xl">
            B
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (route.page === 'register') {
      return <RegisterPage onNavigate={navigate} />;
    }
    return <LoginPage onNavigate={navigate} />;
  }

  switch (route.page) {
    case 'board':
      return <BoardPage projectId={route.projectId} onNavigate={navigate} />;
    case 'project-dashboard':
      return <ProjectDashboardPage projectId={route.projectId} onNavigate={navigate} />;
    case 'audit-log':
      return <AuditLogPage projectId={route.projectId} onNavigate={navigate} />;
    case 'settings':
      return <SettingsPage onNavigate={navigate} />;
    case 'my-work':
      return <MyWorkPage onNavigate={navigate} />;
    case 'login':
    case 'register':
    case 'dashboard':
    default:
      return <DashboardPage onNavigate={navigate} />;
  }
}
