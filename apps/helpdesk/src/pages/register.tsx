import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/common/button';
import { Input } from '@/components/common/input';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
}

export function RegisterPage({ onNavigate }: RegisterPageProps) {
  const { register, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVerifyNotice, setShowVerifyNotice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);
    try {
      await register({ email, password, display_name: displayName });
      onNavigate('/tickets');
    } catch (err: unknown) {
      // Check if the response indicates email verification is required
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'EMAIL_VERIFICATION_REQUIRED') {
        setShowVerifyNotice(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showVerifyNotice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-600 text-white font-bold text-2xl mb-4 shadow-lg shadow-primary-600/30">
              B
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Check your email</h1>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 text-center">
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              We sent a verification link to <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span>.
              Please check your inbox and click the link to verify your account.
            </p>
            <p className="text-sm text-zinc-500">
              After verifying, you can{' '}
              <button
                onClick={() => onNavigate('/login')}
                className="text-primary-600 font-medium hover:text-primary-700"
              >
                sign in here
              </button>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-600 text-white font-bold text-2xl mb-4 shadow-lg shadow-primary-600/30">
            B
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Create your account</h1>
          <p className="text-zinc-500 mt-1">Get support through BigBlueBam Helpdesk</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Input
              id="display-name"
              label="Display Name"
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              autoComplete="name"
            />

            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="Min. 12 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              autoComplete="new-password"
            />

            <Button type="submit" loading={isSubmitting} className="w-full mt-2">
              Create Account
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-zinc-500 mt-6">
          Already have an account?{' '}
          <button
            onClick={() => onNavigate('/login')}
            className="text-primary-600 font-medium hover:text-primary-700"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
