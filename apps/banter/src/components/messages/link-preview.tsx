import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

// ── URL detection ───────────────────────────────────────────────

const URL_RE =
  /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&/=]*/g;

// Internal paths that are handled by cross-product embeds, not link previews
const INTERNAL_PATH_RE = /^https?:\/\/[^/]+\/(b3|bond|banter|beacon|brief|bolt|bearing|board|blast|bench|helpdesk)\//;

interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  site_name?: string;
  favicon?: string;
}

/**
 * Extract external URLs from message content that should get link previews.
 * Excludes internal product URLs (those are handled by CrossProductEmbeds).
 */
export function extractExternalUrls(content: string): string[] {
  // Strip HTML tags
  const plain = content.replace(/<[^>]+>/g, ' ');

  // Also extract href values
  const hrefRe = /href="(https?:\/\/[^"]+)"/g;
  let hrefMatch;
  const urls = new Set<string>();

  const plainMatches = plain.match(URL_RE) || [];
  for (const url of plainMatches) {
    if (!INTERNAL_PATH_RE.test(url)) {
      urls.add(url);
    }
  }

  while ((hrefMatch = hrefRe.exec(content)) !== null) {
    if (!INTERNAL_PATH_RE.test(hrefMatch[1])) {
      urls.add(hrefMatch[1]);
    }
  }

  // Limit to first 3 external URLs
  return Array.from(urls).slice(0, 3);
}

// ── Simple OG metadata fetcher via banter-api proxy ─────────────

async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  try {
    const result = await api.get<{ data: LinkPreviewData }>('/link-preview', {
      url,
    });
    return result.data;
  } catch {
    // Link preview is best-effort; swallow errors silently
    return null;
  }
}

// ── Component ───────────────────────────────────────────────────

interface LinkPreviewsProps {
  content: string;
}

export function LinkPreviews({ content }: LinkPreviewsProps) {
  const [previews, setPreviews] = useState<LinkPreviewData[]>([]);

  useEffect(() => {
    const urls = extractExternalUrls(content);
    if (urls.length === 0) {
      setPreviews([]);
      return;
    }

    let cancelled = false;

    Promise.all(urls.map(fetchLinkPreview)).then((results) => {
      if (!cancelled) {
        setPreviews(results.filter((r): r is LinkPreviewData => r !== null && !!r.title));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [content]);

  if (previews.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 mt-1.5">
      {previews.map((preview) => (
        <LinkPreviewCard key={preview.url} preview={preview} />
      ))}
    </div>
  );
}

function LinkPreviewCard({ preview }: { preview: LinkPreviewData }) {
  const hostname = (() => {
    try {
      return new URL(preview.url).hostname.replace(/^www\./, '');
    } catch {
      return preview.url;
    }
  })();

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex rounded-lg border border-zinc-200 dark:border-zinc-700',
        'hover:bg-zinc-50 dark:hover:bg-zinc-800/70 transition-colors',
        'overflow-hidden max-w-lg border-l-4 border-l-zinc-300 dark:border-l-zinc-600',
      )}
    >
      {/* Text content */}
      <div className="flex-1 min-w-0 px-3 py-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          {preview.favicon ? (
            <img
              src={preview.favicon}
              alt=""
              className="h-3.5 w-3.5 rounded-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <Globe className="h-3 w-3 text-zinc-400" />
          )}
          <span className="text-xs text-zinc-400 truncate">
            {preview.site_name || hostname}
          </span>
        </div>

        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
          {preview.title}
        </p>

        {preview.description && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5">
            {preview.description}
          </p>
        )}
      </div>

      {/* Thumbnail image */}
      {preview.image && (
        <div className="w-20 h-20 flex-shrink-0 self-center mr-2">
          <img
            src={preview.image}
            alt=""
            className="h-full w-full object-cover rounded"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
    </a>
  );
}
