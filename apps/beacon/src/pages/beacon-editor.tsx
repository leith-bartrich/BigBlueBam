interface BeaconEditorPageProps {
  idOrSlug?: string;
  onNavigate: (path: string) => void;
}

export function BeaconEditorPage({ idOrSlug, onNavigate: _onNavigate }: BeaconEditorPageProps) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        {idOrSlug ? 'Edit Beacon' : 'Create Beacon'}
      </h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        {idOrSlug ? `Editing beacon: ${idOrSlug}` : 'Create a new knowledge article.'}
      </p>
    </div>
  );
}
