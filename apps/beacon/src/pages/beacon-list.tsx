interface BeaconListPageProps {
  onNavigate: (path: string) => void;
}

export function BeaconListPage({ onNavigate: _onNavigate }: BeaconListPageProps) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Browse Beacons</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        Browse and filter all knowledge articles.
      </p>
    </div>
  );
}
