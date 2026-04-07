import { Loader2, Star } from 'lucide-react';
import { useStarredDocuments } from '@/hooks/use-documents';
import { DocumentCard } from '@/components/document/document-card';

interface StarredPageProps {
  onNavigate: (path: string) => void;
}

export function StarredPage({ onNavigate }: StarredPageProps) {
  const { data: starredDocs, isLoading } = useStarredDocuments();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
          <Star className="h-6 w-6 text-yellow-500" />
          Starred Documents
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Your bookmarked documents for quick access.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        </div>
      ) : !starredDocs || starredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Star className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mb-3" />
          <p className="text-zinc-500 dark:text-zinc-400">
            No starred documents yet.
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
            Star a document to add it here for quick access.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {starredDocs.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onClick={() => onNavigate(`/documents/${doc.slug ?? doc.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
