interface BeaconDashboardPageProps {
  onNavigate: (path: string) => void;
}

export function BeaconDashboardPage({ onNavigate: _onNavigate }: BeaconDashboardPageProps) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Dashboard</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        Knowledge base analytics and activity overview.
      </p>
    </div>
  );
}
