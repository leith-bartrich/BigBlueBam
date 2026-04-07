interface GraphExplorerPageProps {
  focalId?: string;
  onNavigate: (path: string) => void;
}

export function GraphExplorerPage({ focalId, onNavigate: _onNavigate }: GraphExplorerPageProps) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Knowledge Graph</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        {focalId
          ? `Exploring graph centered on: ${focalId}`
          : 'Visualize the connections between knowledge articles.'}
      </p>
    </div>
  );
}
