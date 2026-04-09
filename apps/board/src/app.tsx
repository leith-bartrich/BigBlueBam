import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { BoardLayout } from '@/components/layout/board-layout';
import { BoardListPage } from '@/pages/board-list';
import { BoardCanvasPage } from '@/pages/board-canvas';
import { BoardNewPage } from '@/pages/board-new';
import { VersionHistoryPage } from '@/pages/version-history';
import { TemplateBrowserPage } from '@/pages/template-browser';
import { StarredBoardsPage } from '@/pages/starred-boards';
import { Loader2 } from 'lucide-react';

type Route =
  | { page: 'home' }
  | { page: 'new' }
  | { page: 'canvas'; id: string }
  | { page: 'versions'; id: string }
  | { page: 'templates' }
  | { page: 'starred' };

const BASE_PATH = '/board';

function stripBase(path: string): string {
  if (path.startsWith(BASE_PATH)) {
    return path.slice(BASE_PATH.length) || '/';
  }
  return path;
}

function parseRoute(path: string): Route {
  const p = stripBase(path);

  if (p === '/' || p === '') return { page: 'home' };
  if (p === '/new') return { page: 'new' };
  if (p === '/templates') return { page: 'templates' };
  if (p === '/starred') return { page: 'starred' };

  // /:id/versions
  const versionsMatch = p.match(/^\/([^/]+)\/versions$/);
  if (versionsMatch) {
    return { page: 'versions', id: versionsMatch[1]! };
  }

  // /:id — canvas
  const canvasMatch = p.match(/^\/([^/]+)$/);
  if (canvasMatch) {
    return { page: 'canvas', id: canvasMatch[1]! };
  }

  return { page: 'home' };
}

export function App() {
  const { isAuthenticated, isLoading, fetchMe } = useAuthStore();
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // Apply saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('bbam-theme') ?? 'system';
    const root = document.documentElement;
    root.classList.remove('dark');
    if (savedTheme === 'dark') {
      root.classList.add('dark');
    } else if (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    }
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
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-100">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Board</h1>
          <p className="text-zinc-400">Please log in to BigBlueBam first to access Board.</p>
          <a href="/b3/" className="inline-block px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            Go to BigBlueBam Login
          </a>
        </div>
      </div>
    );
  }

  // Canvas page is full-screen — no layout wrapper
  if (route.page === 'canvas') {
    return <BoardCanvasPage boardId={route.id} onNavigate={navigate} />;
  }

  const renderPage = () => {
    switch (route.page) {
      case 'home':
        return <BoardListPage onNavigate={navigate} />;
      case 'new':
        return <BoardNewPage onNavigate={navigate} />;
      case 'versions':
        return <VersionHistoryPage boardId={route.id} onNavigate={navigate} />;
      case 'templates':
        return <TemplateBrowserPage onNavigate={navigate} />;
      case 'starred':
        return <StarredBoardsPage onNavigate={navigate} />;
      default:
        return null;
    }
  };

  return (
    <BoardLayout onNavigate={navigate} activeRoute={route}>
      {renderPage()}
    </BoardLayout>
  );
}
