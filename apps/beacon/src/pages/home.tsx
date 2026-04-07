interface HomePageProps {
  onNavigate: (path: string) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Knowledge Home</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        Welcome to Beacon, your team's knowledge base.
      </p>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          onClick={() => onNavigate('/create')}
          className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 text-left hover:border-primary-300 hover:bg-primary-50/50 dark:hover:border-primary-700 dark:hover:bg-primary-900/10 transition-colors"
        >
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Create a Beacon</h3>
          <p className="mt-1 text-sm text-zinc-500">Write a new knowledge article</p>
        </button>
        <button
          onClick={() => onNavigate('/list')}
          className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 text-left hover:border-primary-300 hover:bg-primary-50/50 dark:hover:border-primary-700 dark:hover:bg-primary-900/10 transition-colors"
        >
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Browse</h3>
          <p className="mt-1 text-sm text-zinc-500">Explore existing knowledge articles</p>
        </button>
        <button
          onClick={() => onNavigate('/graph')}
          className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 text-left hover:border-primary-300 hover:bg-primary-50/50 dark:hover:border-primary-700 dark:hover:bg-primary-900/10 transition-colors"
        >
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Knowledge Graph</h3>
          <p className="mt-1 text-sm text-zinc-500">Visualize connections between articles</p>
        </button>
      </div>
    </div>
  );
}
