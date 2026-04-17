import { useState, useEffect } from 'react';
import { bbbGet, BbbApiError } from '@/lib/bbb-api';
import {
  ClipboardList,
  Handshake,
  ExternalLink,
  AlertCircle,
  Calendar,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── URL detection patterns ──────────────────────────────────────

const BAM_TASK_RE = /\/b3\/(?:tasks|board)\/(?:ref\/)?([A-Z]{2,10}-\d+)/;
const BAM_TASK_ID_RE = /\/b3\/tasks\/([0-9a-f-]{36})/;
const BOND_DEAL_RE = /\/bond\/deals\/([0-9a-f-]{36})/;
const BOND_CONTACT_RE = /\/bond\/contacts\/([0-9a-f-]{36})/;
const BOND_COMPANY_RE = /\/bond\/companies\/([0-9a-f-]{36})/;

interface EmbedData {
  type: 'bam-task' | 'bond-deal' | 'bond-contact' | 'bond-company';
  title: string;
  subtitle?: string;
  status?: string;
  assignee?: string;
  url: string;
  extra?: Record<string, string>;
}

/**
 * Extract cross-product URLs from message content (plain text or HTML).
 * Returns the first matched URL info, or null if none found.
 */
export function extractCrossProductUrls(content: string): Array<{
  type: EmbedData['type'];
  id: string;
  url: string;
}> {
  const results: Array<{ type: EmbedData['type']; id: string; url: string }> = [];
  const seen = new Set<string>();

  // Strip HTML tags for URL matching
  const plain = content.replace(/<[^>]+>/g, ' ');

  // Extract all href values from anchor tags too
  const hrefRe = /href="([^"]+)"/g;
  let hrefMatch;
  const urls: string[] = [plain];
  while ((hrefMatch = hrefRe.exec(content)) !== null) {
    urls.push(hrefMatch[1]);
  }

  const combined = urls.join(' ');

  // Find /b3/ task references
  const bamTaskMatch = combined.match(BAM_TASK_RE);
  if (bamTaskMatch) {
    const key = `bam-task:${bamTaskMatch[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        type: 'bam-task',
        id: bamTaskMatch[1],
        url: `/b3/tasks/ref/${bamTaskMatch[1]}`,
      });
    }
  }

  const bamIdMatch = combined.match(BAM_TASK_ID_RE);
  if (bamIdMatch) {
    const key = `bam-task:${bamIdMatch[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        type: 'bam-task',
        id: bamIdMatch[1],
        url: `/b3/tasks/${bamIdMatch[1]}`,
      });
    }
  }

  // Find /bond/ deal references
  const bondDealMatch = combined.match(BOND_DEAL_RE);
  if (bondDealMatch) {
    const key = `bond-deal:${bondDealMatch[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        type: 'bond-deal',
        id: bondDealMatch[1],
        url: `/bond/deals/${bondDealMatch[1]}`,
      });
    }
  }

  // Find /bond/ contact references
  const bondContactMatch = combined.match(BOND_CONTACT_RE);
  if (bondContactMatch) {
    const key = `bond-contact:${bondContactMatch[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        type: 'bond-contact',
        id: bondContactMatch[1],
        url: `/bond/contacts/${bondContactMatch[1]}`,
      });
    }
  }

  // Find /bond/ company references
  const bondCompanyMatch = combined.match(BOND_COMPANY_RE);
  if (bondCompanyMatch) {
    const key = `bond-company:${bondCompanyMatch[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        type: 'bond-company',
        id: bondCompanyMatch[1],
        url: `/bond/companies/${bondCompanyMatch[1]}`,
      });
    }
  }

  return results;
}

// ── Data fetching ───────────────────────────────────────────────

async function fetchBamTask(id: string): Promise<EmbedData | null> {
  try {
    // id could be a human_id like "FRND-7" or a uuid
    const isRef = /^[A-Z]/.test(id);
    const path = isRef ? `/tasks/by-ref/${id}` : `/tasks/${id}`;
    const res = await bbbGet<{ data: {
      id: string;
      title: string;
      human_id: string;
      status: string;
      phase_name?: string;
      assignee_display_name?: string;
      priority?: string;
      due_date?: string;
    } }>(path);

    const t = res.data;
    return {
      type: 'bam-task',
      title: `${t.human_id}: ${t.title}`,
      subtitle: t.phase_name,
      status: t.status,
      assignee: t.assignee_display_name,
      url: `/b3/tasks/ref/${t.human_id}`,
      extra: {
        ...(t.priority ? { priority: t.priority } : {}),
        ...(t.due_date ? { due: new Date(t.due_date).toLocaleDateString() } : {}),
      },
    };
  } catch (err) {
    if (err instanceof BbbApiError && err.status === 404) return null;
    console.warn('Failed to fetch Bam task embed:', err);
    return null;
  }
}

async function fetchBondDeal(id: string): Promise<EmbedData | null> {
  try {
    const res = await bbbGet<{ data: {
      id: string;
      name: string;
      stage_name?: string;
      value?: number;
      currency?: string;
      owner_display_name?: string;
      company_name?: string;
    } }>(`/bond/deals/${id}`);

    // Bond API is at /bond/api, not /b3/api. Use a direct fetch.
    return null; // Will be handled by direct fetch below
  } catch {
    return null;
  }
}

async function fetchBondEntity(
  type: 'deal' | 'contact' | 'company',
  id: string,
): Promise<EmbedData | null> {
  try {
    const url = `/bond/api/v1/${type}s/${id}`;
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return null;
    const json = await response.json();
    const d = json.data;

    if (type === 'deal') {
      const valueStr = d.value
        ? `${d.currency || '$'}${Number(d.value).toLocaleString()}`
        : undefined;
      return {
        type: 'bond-deal',
        title: d.name || 'Untitled Deal',
        subtitle: d.stage_name || d.pipeline_name,
        status: d.status,
        assignee: d.owner_display_name,
        url: `/bond/deals/${id}`,
        extra: {
          ...(valueStr ? { value: valueStr } : {}),
          ...(d.company_name ? { company: d.company_name } : {}),
        },
      };
    }

    if (type === 'contact') {
      return {
        type: 'bond-contact',
        title: d.display_name || `${d.first_name} ${d.last_name}`,
        subtitle: d.company_name || d.email,
        url: `/bond/contacts/${id}`,
        extra: {
          ...(d.title ? { role: d.title } : {}),
        },
      };
    }

    if (type === 'company') {
      return {
        type: 'bond-company',
        title: d.name || 'Untitled Company',
        subtitle: d.industry,
        url: `/bond/companies/${id}`,
        extra: {
          ...(d.website ? { website: d.website } : {}),
        },
      };
    }

    return null;
  } catch {
    return null;
  }
}

// ── Component ───────────────────────────────────────────────────

interface CrossProductEmbedProps {
  content: string;
}

export function CrossProductEmbeds({ content }: CrossProductEmbedProps) {
  const [embeds, setEmbeds] = useState<EmbedData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const urls = extractCrossProductUrls(content);
    if (urls.length === 0) {
      setEmbeds([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all(
      urls.map(async (u) => {
        if (u.type === 'bam-task') {
          return fetchBamTask(u.id);
        }
        if (u.type === 'bond-deal') {
          return fetchBondEntity('deal', u.id);
        }
        if (u.type === 'bond-contact') {
          return fetchBondEntity('contact', u.id);
        }
        if (u.type === 'bond-company') {
          return fetchBondEntity('company', u.id);
        }
        return null;
      }),
    ).then((results) => {
      if (!cancelled) {
        setEmbeds(results.filter((r): r is EmbedData => r !== null));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [content]);

  if (embeds.length === 0 && !loading) return null;

  return (
    <div className="flex flex-col gap-1.5 mt-1.5">
      {embeds.map((embed, idx) => (
        <EmbedCard key={`${embed.type}-${idx}`} embed={embed} />
      ))}
    </div>
  );
}

function EmbedCard({ embed }: { embed: EmbedData }) {
  const IconComponent = embed.type === 'bam-task' ? ClipboardList : Handshake;

  const borderColor =
    embed.type === 'bam-task'
      ? 'border-l-blue-500'
      : embed.type === 'bond-deal'
        ? 'border-l-green-500'
        : 'border-l-purple-500';

  return (
    <a
      href={embed.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-start gap-2.5 px-3 py-2 rounded-lg border border-zinc-200',
        'dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/70',
        'transition-colors text-sm border-l-4 max-w-md',
        borderColor,
      )}
    >
      <IconComponent className="h-4 w-4 text-zinc-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {embed.title}
          </span>
          <ExternalLink className="h-3 w-3 text-zinc-400 flex-shrink-0" />
        </div>

        {embed.subtitle && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {embed.subtitle}
          </p>
        )}

        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {embed.status && (
            <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  embed.status === 'done' || embed.status === 'closed' || embed.status === 'won'
                    ? 'bg-green-500'
                    : embed.status === 'in_progress' || embed.status === 'active'
                      ? 'bg-blue-500'
                      : embed.status === 'lost'
                        ? 'bg-red-500'
                        : 'bg-zinc-400',
                )}
              />
              {embed.status.replace(/_/g, ' ')}
            </span>
          )}

          {embed.assignee && (
            <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
              <User className="h-3 w-3" />
              {embed.assignee}
            </span>
          )}

          {embed.extra &&
            Object.entries(embed.extra).map(([key, value]) => (
              <span
                key={key}
                className="text-xs text-zinc-400"
              >
                {value}
              </span>
            ))}
        </div>
      </div>
    </a>
  );
}
