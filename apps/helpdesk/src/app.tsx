import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { VerifyEmailPage } from '@/pages/verify-email';
import { TicketsListPage } from '@/pages/tickets-list';
import { NewTicketPage } from '@/pages/new-ticket';
import { TicketDetailPage } from '@/pages/ticket-detail';
import { Header } from '@/components/layout/header';
import { Loader2 } from 'lucide-react';

type Route =
  | { page: 'login' }
  | { page: 'register' }
  | { page: 'verify' }
  | { page: 'tickets' }
  | { page: 'new-ticket' }
  | { page: 'ticket-detail'; ticketId: string };

const BASE_PATH = '/helpdesk';

function stripBase(path: string): string {
  if (path.startsWith(BASE_PATH)) {
    return path.slice(BASE_PATH.length) || '/';
  }
  return path;
}

function parseRoute(path: string): Route {
  const p = stripBase(path);
  const ticketMatch = p.match(/^\/tickets\/([^/]+)$/);
  if (ticketMatch && ticketMatch[1] !== 'new') {
    return { page: 'ticket-detail', ticketId: ticketMatch[1]! };
  }
  if (p === '/tickets/new') return { page: 'new-ticket' };
  if (p === '/tickets') return { page: 'tickets' };
  if (p === '/register') return { page: 'register' };
  if (p === '/verify') return { page: 'verify' };
  if (p === '/login') return { page: 'login' };
  return { page: 'tickets' };
}

export function App() {
  const { isAuthenticated, isLoading, fetchMe } = useAuthStore();
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

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

  // Verify email page is accessible without auth
  if (route.page === 'verify') {
    return <VerifyEmailPage onNavigate={navigate} />;
  }

  if (!isAuthenticated) {
    if (route.page === 'register') {
      return <RegisterPage onNavigate={navigate} />;
    }
    return <LoginPage onNavigate={navigate} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header onNavigate={navigate} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        {(() => {
          switch (route.page) {
            case 'new-ticket':
              return <NewTicketPage onNavigate={navigate} />;
            case 'ticket-detail':
              return <TicketDetailPage ticketId={route.ticketId} onNavigate={navigate} />;
            case 'tickets':
            default:
              return <TicketsListPage onNavigate={navigate} />;
          }
        })()}
      </main>
    </div>
  );
}
