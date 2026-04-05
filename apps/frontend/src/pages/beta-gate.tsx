import { Github, Globe, Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/common/button';

interface BetaGatePageProps {
  onNavigate: (path: string) => void;
}

/**
 * Landing page shown when a visitor clicks "Create one" on the login page
 * while public signup is closed. Explains the limited-beta posture and
 * points prospects at (a) the open-source project, (b) the marketing site,
 * and (c) the notify-me form so a SuperUser can invite them later.
 */
export function BetaGatePage({ onNavigate }: BetaGatePageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-600 text-white font-bold text-2xl mb-4 shadow-lg shadow-primary-600/30">
            B
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 text-center">
            BigBlueBam is in limited beta
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-center max-w-md">
            New accounts are invite-only right now. In the meantime you're
            welcome to try the full project for free — it's open source and
            runs anywhere Docker does.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
          <a
            href="https://github.com/eoffermann/BigBlueBam"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Github className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              <div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  Run it yourself
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  Clone the GitHub repo — one command to deploy.
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-zinc-400 group-hover:text-primary-600 transition-colors" />
          </a>

          <a
            href="/"
            className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
              <div>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  Learn more
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  Tour the features on the main site.
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-zinc-400 group-hover:text-primary-600 transition-colors" />
          </a>

          <button
            onClick={() => onNavigate('/notify')}
            className="w-full flex items-center justify-between gap-3 rounded-lg border border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/40 p-4 hover:border-primary-500 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              <div className="text-left">
                <div className="font-medium text-primary-900 dark:text-primary-100">
                  Get notified when signups open
                </div>
                <div className="text-sm text-primary-700 dark:text-primary-300">
                  Leave your name and email — we'll reach out.
                </div>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary-500 group-hover:text-primary-700 transition-colors" />
          </button>
        </div>

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-6">
          Already have an account?{' '}
          <button
            onClick={() => onNavigate('/login')}
            className="text-primary-600 font-medium hover:text-primary-700"
          >
            Sign in
          </button>
        </p>

        <div className="mt-4 text-center">
          <Button variant="ghost" size="sm" onClick={() => onNavigate('/login')}>
            Back to sign in
          </Button>
        </div>
      </div>
    </div>
  );
}
