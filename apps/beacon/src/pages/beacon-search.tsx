interface BeaconSearchPageProps {
  onNavigate: (path: string) => void;
}

export function BeaconSearchPage({ onNavigate: _onNavigate }: BeaconSearchPageProps) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Search</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        Full-text search across all knowledge articles.
      </p>
    </div>
  );
}
