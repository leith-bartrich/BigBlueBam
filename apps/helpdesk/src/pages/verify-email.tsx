import { useState, useEffect } from 'react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/common/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface VerifyEmailPageProps {
  onNavigate: (path: string) => void;
}

export function VerifyEmailPage({ onNavigate }: VerifyEmailPageProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setErrorMessage('No verification token provided.');
      return;
    }

    api
      .post('/auth/verify-email', { token })
      .then(() => {
        setStatus('success');
      })
      .catch((err) => {
        setStatus('error');
        setErrorMessage(err instanceof ApiError ? err.message : 'Verification failed. The link may have expired.');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-600 text-white font-bold text-2xl mb-4 shadow-lg shadow-primary-600/30">
            B
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Email Verification</h1>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 text-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
              <p className="text-zinc-600 dark:text-zinc-400">Verifying your email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <p className="text-zinc-900 dark:text-zinc-100 font-medium">Your email has been verified!</p>
              <p className="text-sm text-zinc-500 mb-2">You can now sign in to your account.</p>
              <Button onClick={() => onNavigate('/login')}>Go to Login</Button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle className="h-10 w-10 text-red-500" />
              <p className="text-zinc-900 dark:text-zinc-100 font-medium">Verification Failed</p>
              <p className="text-sm text-red-600 dark:text-red-400 mb-2">{errorMessage}</p>
              <Button variant="secondary" onClick={() => onNavigate('/login')}>
                Go to Login
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
