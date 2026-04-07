interface BeaconDetailPageProps {
  idOrSlug: string;
  onNavigate: (path: string) => void;
}

export function BeaconDetailPage({ idOrSlug, onNavigate: _onNavigate }: BeaconDetailPageProps) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Beacon Detail</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        Viewing beacon: <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm">{idOrSlug}</code>
      </p>
    </div>
  );
}
