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
import { SprintReportPage } from '@/pages/sprint-report';
import { SuperuserPage } from '@/pages/superuser';
import { SuperuserPeopleListPage } from '@/pages/superuser/people-list';
import { SuperuserPeopleDetailPage } from '@/pages/superuser/people-detail';
import { PeoplePage } from '@/pages/people';
import { PersonDetailPage } from '@/pages/people/detail';
import { GuestAcceptPage } from '@/pages/guest-accept';
import { PasswordChangePage } from '@/pages/password-change';
import { TaskRefResolverPage } from '@/pages/task-ref-resolver';
import { Loader2 } from 'lucide-react';

type Route =
  | { page: 'login' }
  | { page: 'register' }
  | { page: 'password-change' }
  | { page: 'dashboard' }
  | { page: 'board'; projectId: string }
  | { page: 'project-dashboard'; projectId: string }
  | { page: 'audit-log'; projectId: string }
  | { page: 'sprint-report'; projectId: string; sprintId: string }
  | { page: 'settings' }
  | { page: 'my-work' }
  | { page: 'superuser' }
  | { page: 'superuser-people' }
  | { page: 'superuser-person-detail'; userId: string }
  | { page: 'people' }
  | { page: 'person-detail'; userId: string }
  | { page: 'guest-accept'; token: string }
  | { page: 'task-ref'; ref: string };

const BASE_PATH = '/b3';

function stripBase(path: string): string {
  if (path.startsWith(BASE_PATH)) {
    return path.slice(BASE_PATH.length) || '/';
  }
  return path;
}

function parseRoute(path: string): Route {
  const p = stripBase(path);
  const guestAcceptMatch = p.match(/^\/guests\/accept\/(.+)$/);
  if (guestAcceptMatch) {
    return { page: 'guest-accept', token: guestAcceptMatch[1]! };
  }
  const taskRefMatch = p.match(/^\/tasks\/ref\/([^/]+)$/);
  if (taskRefMatch) {
    return { page: 'task-ref', ref: decodeURIComponent(taskRefMatch[1]!) };
  }
  const boardMatch = p.match(/^\/projects\/([^/]+)\/board$/);
  if (boardMatch) {
    return { page: 'board', projectId: boardMatch[1]! };
  }
  const dashboardMatch = p.match(/^\/projects\/([^/]+)\/dashboard$/);
  if (dashboardMatch) {
    return { page: 'project-dashboard', projectId: dashboardMatch[1]! };
  }
  const auditMatch = p.match(/^\/projects\/([^/]+)\/audit-log$/);
  if (auditMatch) {
    return { page: 'audit-log', projectId: auditMatch[1]! };
  }
  const sprintReportMatch = p.match(/^\/projects\/([^/]+)\/sprints\/([^/]+)\/report$/);
  if (sprintReportMatch) {
    return { page: 'sprint-report', projectId: sprintReportMatch[1]!, sprintId: sprintReportMatch[2]! };
  }
  const superuserPersonMatch = p.match(/^\/superuser\/people\/([^/]+)$/);
  if (superuserPersonMatch) {
    return { page: 'superuser-person-detail', userId: superuserPersonMatch[1]! };
  }
  if (p === '/superuser/people' || p === '/superuser/people/') {
    return { page: 'superuser-people' };
  }
  const personDetailMatch = p.match(/^\/people\/([^/]+)$/);
  if (personDetailMatch) {
    return { page: 'person-detail', userId: personDetailMatch[1]! };
  }
  if (p === '/people' || p === '/people/') return { page: 'people' };
  if (p === '/register') return { page: 'register' };
  if (p === '/login') return { page: 'login' };
  if (p === '/password-change') return { page: 'password-change' };
  if (p === '/settings') return { page: 'settings' };
  if (p === '/my-work') return { page: 'my-work' };
  if (p === '/superuser') return { page: 'superuser' };
  return { page: 'dashboard' };
}

export function App() {
  const { isAuthenticated, isLoading, fetchMe, user } = useAuthStore();
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
    const fullPath = `${BASE_PATH}${path}`;
    window.history.pushState(null, '', fullPath);
    setRoute(parseRoute(fullPath));
  }, []);

  // Force-password-change gate: if the server has flagged this user, block
  // every page except the password-change form (and the public auth pages).
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) return;
    if (user.force_password_change !== true) return;
    if (
      route.page === 'password-change' ||
      route.page === 'login' ||
      route.page === 'register'
    ) {
      return;
    }
    navigate('/password-change');
  }, [isLoading, isAuthenticated, user, route.page, navigate]);

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

  // Guest-accept is public — it works whether or not the user is logged in.
  // (The page itself will warn an already-signed-in user.)
  if (route.page === 'guest-accept') {
    return <GuestAcceptPage token={route.token} onNavigate={navigate} />;
  }

  if (!isAuthenticated) {
    if (route.page === 'register') {
      return <RegisterPage onNavigate={navigate} />;
    }
    return <LoginPage onNavigate={navigate} />;
  }

  // Authenticated but must change password first — render only the
  // password-change form, no layout, no other pages reachable.
  if (user?.force_password_change === true && route.page !== 'password-change') {
    return <PasswordChangePage onNavigate={navigate} />;
  }

  if (route.page === 'password-change') {
    return <PasswordChangePage onNavigate={navigate} />;
  }

  switch (route.page) {
    case 'board':
      return <BoardPage projectId={route.projectId} onNavigate={navigate} />;
    case 'project-dashboard':
      return <ProjectDashboardPage projectId={route.projectId} onNavigate={navigate} />;
    case 'audit-log':
      return <AuditLogPage projectId={route.projectId} onNavigate={navigate} />;
    case 'sprint-report':
      return <SprintReportPage projectId={route.projectId} sprintId={route.sprintId} onNavigate={navigate} />;
    case 'settings':
      return <SettingsPage onNavigate={navigate} />;
    case 'my-work':
      return <MyWorkPage onNavigate={navigate} />;
    case 'superuser':
      return <SuperuserPage onNavigate={navigate} />;
    case 'superuser-people':
      return <SuperuserPeopleListPage onNavigate={navigate} />;
    case 'superuser-person-detail':
      return <SuperuserPeopleDetailPage userId={route.userId} onNavigate={navigate} />;
    case 'people':
      return <PeoplePage onNavigate={navigate} />;
    case 'person-detail':
      return <PersonDetailPage userId={route.userId} onNavigate={navigate} />;
    case 'task-ref':
      return <TaskRefResolverPage ref={route.ref} onNavigate={navigate} />;
    case 'login':
    case 'register':
    case 'dashboard':
    default:
      return <DashboardPage onNavigate={navigate} />;
  }
}
