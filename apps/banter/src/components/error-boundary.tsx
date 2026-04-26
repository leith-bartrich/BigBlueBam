import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string | number;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  info: ErrorInfo | null;
}

/**
 * Catches render-time errors anywhere in the subtree and renders a fallback
 * UI instead of unmounting the React root. Without this, React 19 unmounts
 * the entire root on an uncaught render error, leaving an empty
 * `<div id="root">` — and the body's `dark:bg-zinc-950` background paints
 * the "black screen on iPad" symptom reported in the calling branch.
 *
 * The fallback shows the error message AND stack on-screen because mobile
 * Safari has no devtools without a tethered Mac, so we have to surface the
 * crash details where the user can read them.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Pick<ErrorBoundaryState, 'error'> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    // eslint-disable-next-line no-console
    console.error('[Banter ErrorBoundary] Uncaught render error:', error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, info: null });
    }
  }

  reset = () => {
    this.setState({ error: null, info: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="min-h-screen w-full overflow-auto bg-zinc-50 dark:bg-zinc-950 p-6">
        <div className="max-w-2xl mx-auto rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-red-900 dark:text-red-100">
                Banter hit a render error
              </h2>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                The screen below shows the actual exception so we can fix it.
              </p>
              {error.message && (
                <pre className="mt-3 max-h-32 overflow-auto rounded-md bg-red-100 dark:bg-red-900/40 p-3 text-xs font-mono text-red-900 dark:text-red-200 whitespace-pre-wrap break-words">
                  {error.message}
                </pre>
              )}
              {error.stack && (
                <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-red-100/70 dark:bg-red-900/30 p-3 text-[10px] leading-tight font-mono text-red-800 dark:text-red-300 whitespace-pre-wrap break-words">
                  {error.stack}
                </pre>
              )}
              {info?.componentStack && (
                <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-red-100/70 dark:bg-red-900/30 p-3 text-[10px] leading-tight font-mono text-red-800 dark:text-red-300 whitespace-pre-wrap break-words">
                  {info.componentStack}
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
