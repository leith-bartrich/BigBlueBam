import { BootstrapForm } from '@/components/auth/bootstrap-form';

interface SuperuserBootstrapPageProps {
  onNavigate: (path: string) => void;
}

export function SuperuserBootstrapPage({ onNavigate }: SuperuserBootstrapPageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-600 text-white font-bold text-2xl mb-4 shadow-lg shadow-primary-600/30">
            B
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">First-run setup</h1>
          <p className="text-zinc-500 mt-1 text-center">
            No accounts exist on this installation yet. Create the first SuperUser to get started.
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
          <BootstrapForm onSuccess={() => onNavigate('/')} />
        </div>

        <p className="text-center text-xs text-zinc-500 mt-6">
          This page is available once, to create the root account for this installation. It disappears
          as soon as a SuperUser exists.
        </p>
      </div>
    </div>
  );
}
