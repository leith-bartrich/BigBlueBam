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

function parseRoute(path: string): Route {
  const ticketMatch = path.match(/^\/tickets\/([^/]+)$/);
  if (ticketMatch && ticketMatch[1] !== 'new') {
    return { page: 'ticket-detail', ticketId: ticketMatch[1]! };
  }
  if (path === '/tickets/new') return { page: 'new-ticket' };
  if (path === '/tickets') return { page: 'tickets' };
  if (path === '/register') return { page: 'register' };
  if (path === '/verify') return { page: 'verify' };
  if (path === '/login') return { page: 'login' };
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
