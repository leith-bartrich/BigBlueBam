import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional key — when it changes, the boundary resets itself. */
  resetKey?: string | number;
  /** Optional fallback override. Receives the error + reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time errors anywhere in the subtree and renders a fallback
 * UI instead of unmounting the React root. Without this, React 19 unmounts
 * the entire root on an uncaught render error, leaving an empty
 * `<div id="root">` and the body background showing through — the "appears
 * then turns black" symptom reported by users.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console so devs have something to grep for in the browser.
    // eslint-disable-next-line no-console
    console.error('[Beacon ErrorBoundary] Uncaught render error:', error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset when the external resetKey changes (e.g., route change).
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="flex items-center justify-center min-h-[60vh] p-8">
        <div className="max-w-lg w-full rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">
                Something went wrong
              </h2>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                Beacon hit an unexpected error rendering this page. Your data is safe.
              </p>
              {error.message && (
                <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-red-100 dark:bg-red-900/40 p-3 text-xs font-mono text-red-900 dark:text-red-200 whitespace-pre-wrap break-words">
                  {error.message}
                </pre>
              )}
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={this.reset}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-sm font-medium text-white transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </button>
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-red-950/50 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  Reload page
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
