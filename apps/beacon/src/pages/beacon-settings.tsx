interface BeaconSettingsPageProps {
  onNavigate: (path: string) => void;
}

export function BeaconSettingsPage({ onNavigate: _onNavigate }: BeaconSettingsPageProps) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Settings</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        Configure your Beacon knowledge base preferences.
      </p>
    </div>
  );
}
