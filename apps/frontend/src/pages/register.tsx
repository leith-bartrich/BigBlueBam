import { RegisterForm } from '@/components/auth/register-form';

interface RegisterPageProps {
  onNavigate: (path: string) => void;
}

export function RegisterPage({ onNavigate }: RegisterPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-600 text-white font-bold text-2xl mb-4 shadow-lg shadow-primary-600/30">
            B
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Create your account</h1>
          <p className="text-zinc-500 mt-1">Start managing your projects with BigBlueBam</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
          <RegisterForm onSuccess={() => onNavigate('/')} />
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
