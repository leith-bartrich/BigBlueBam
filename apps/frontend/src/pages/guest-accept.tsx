import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Input } from '@/components/common/input';
import { Button } from '@/components/common/button';

interface GuestAcceptPageProps {
  token: string;
  onNavigate: (path: string) => void;
}

type Status = 'form' | 'submitting' | 'success' | 'error';

interface AcceptResponse {
  data: {
    id: string;
    email: string;
    display_name: string;
    role: string;
    org_id: string;
    project_ids: string[] | null;
    channel_ids: string[] | null;
  };
}

export function GuestAcceptPage({ token, onNavigate }: GuestAcceptPageProps) {
  const { login, isAuthenticated } = useAuthStore();
  const [status, setStatus] = useState<Status>('form');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');

  // If user is already logged in, they can't accept a guest invite that way
  // (the endpoint creates a new user). Show a notice.
  useEffect(() => {
    if (isAuthenticated) {
      setStatus('error');
      setErrorMessage(
        'You are currently signed in. Please sign out before accepting a guest invitation, since accepting creates a new guest account.',
      );
    }
  }, [isAuthenticated]);

  // On success, redirect to dashboard after a brief pause.
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        onNavigate('/');
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status, onNavigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !displayName || !password) {
      setErrorMessage('Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }
    setStatus('submitting');
    setErrorMessage('');
    try {
      await api.post<AcceptResponse>(`/v1/guests/accept/${encodeURIComponent(token)}`, {
        email,
        display_name: displayName,
        password,
      });
      // Auto-login with the freshly created credentials.
      try {
        await login(email, password);
        setStatus('success');
      } catch {
        // Account was created but auto-login failed — send them to login.
        setStatus('success');
      }
    } catch (err) {
      setStatus('error');
      if (err instanceof ApiError) {
        if (err.status === 410) {
          setErrorMessage('This invitation has expired, been revoked, or was already accepted.');
        } else if (err.status === 404) {
          setErrorMessage('Invitation not found. Please check your invitation link.');
        } else if (err.status === 400 && err.code === 'VALIDATION_ERROR') {
          setErrorMessage(err.message || 'The email you entered does not match the invitation.');
        } else if (err.status === 429) {
          setErrorMessage('Too many attempts. Please wait 15 minutes and try again.');
        } else {
          setErrorMessage(err.message || 'Failed to accept invitation.');
        }
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-600 text-white font-bold text-2xl mb-4 shadow-lg shadow-primary-600/30">
            B
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Accept guest invitation
          </h1>
          <p className="text-zinc-500 mt-1 text-center">
            Create your guest account to join the workspace
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
          {status === 'success' && (
            <div className="flex flex-col items-center text-center py-4">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Welcome aboard!
              </h2>
              <p className="text-sm text-zinc-500 mt-2">
                Your guest account has been created. Redirecting you now...
              </p>
              <Loader2 className="h-5 w-5 animate-spin text-primary-500 mt-4" />
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center text-center py-4">
              <AlertCircle className="h-12 w-12 text-red-500 mb-3" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Unable to accept invitation
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">{errorMessage}</p>
              <button
                onClick={() => onNavigate('/login')}
                className="text-primary-600 font-medium hover:text-primary-700 mt-4 text-sm"
              >
                Go to sign in
              </button>
            </div>
          )}

          {(status === 'form' || status === 'submitting') && !isAuthenticated && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMessage && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}
              <p className="text-xs text-zinc-500">
                Enter the email address your invitation was sent to, then choose a display name and
                password for your new guest account.
              </p>
              <Input
                id="email"
                label="Email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <Input
                id="display_name"
                label="Display name"
                placeholder="Jane Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
              <Input
                id="password"
                label="Password"
                type="password"
                placeholder="Min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <Button type="submit" className="w-full" loading={status === 'submitting'}>
                Accept invitation
              </Button>
            </form>
          )}
        </div>

        {status !== 'success' && (
          <p className="text-center text-sm text-zinc-500 mt-6">
            Already have an account?{' '}
            <button
              onClick={() => onNavigate('/login')}
              className="text-primary-600 font-medium hover:text-primary-700"
            >
              Sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
