import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../src/middleware/api-client.js';
import {
  registerResolveTools,
  extractNgramPhrases,
  resolveReferences,
} from '../src/tools/resolve-tools.js';
import {
  MENTION_PATTERNS,
  extractPinnedMentions,
  stripPinnedMentions,
} from '@bigbluebam/shared';

// ---------------------------------------------------------------------------
// Static guards
// ---------------------------------------------------------------------------

describe('resolve_references / mention syntax guards', () => {
  it('does not import any LLM SDK', async () => {
    // Inspect the module source on disk. No LLM SDK imports allowed.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const url = await import('node:url');
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const src = await fs.readFile(
      path.resolve(here, '..', 'src', 'tools', 'resolve-tools.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/@anthropic-ai\/sdk/);
    expect(src).not.toMatch(/from ['"]openai['"]/);
    expect(src).not.toMatch(/@google\/generative-ai/);
  });

  it('exposes the canonical mention patterns from @bigbluebam/shared', () => {
    expect(MENTION_PATTERNS.task).toBeInstanceOf(RegExp);
    expect(MENTION_PATTERNS.deal).toBeInstanceOf(RegExp);
    expect(MENTION_PATTERNS.contact).toBeInstanceOf(RegExp);
    expect(MENTION_PATTERNS.company).toBeInstanceOf(RegExp);
    expect(MENTION_PATTERNS.document).toBeInstanceOf(RegExp);
    expect(MENTION_PATTERNS.ticket).toBeInstanceOf(RegExp);
    expect(MENTION_PATTERNS.user).toBeInstanceOf(RegExp);
    expect(MENTION_PATTERNS.project).toBeInstanceOf(RegExp);
  });
});

// ---------------------------------------------------------------------------
// Mention-syntax collision tests (#123 ticket vs #slug project)
// ---------------------------------------------------------------------------

describe('mention-syntax collision: #NNN ticket vs #slug project', () => {
  it('resolves #123 as a ticket', () => {
    const mentions = extractPinnedMentions('please look at #123 today');
    const tickets = mentions.filter((m) => m.kind === 'ticket');
    const projects = mentions.filter((m) => m.kind === 'project');
    expect(tickets).toHaveLength(1);
    expect(tickets[0]!.value).toBe('123');
    expect(projects).toHaveLength(0);
  });

  it('resolves #project-slug as a project', () => {
    const mentions = extractPinnedMentions('ping me about #marketing-ops');
    const projects = mentions.filter((m) => m.kind === 'project');
    const tickets = mentions.filter((m) => m.kind === 'ticket');
    expect(projects).toHaveLength(1);
    expect(projects[0]!.value).toBe('marketing-ops');
    expect(tickets).toHaveLength(0);
  });

  it('handles mixed input without double-counting', () => {
    const mentions = extractPinnedMentions('review #123 and #launch-prep');
    expect(mentions.filter((m) => m.kind === 'ticket')).toHaveLength(1);
    expect(mentions.filter((m) => m.kind === 'project')).toHaveLength(1);
  });

  it('matches bracketed [[ticket:N]] long form too', () => {
    const mentions = extractPinnedMentions('see [[ticket:4567]] for details');
    expect(mentions.filter((m) => m.kind === 'ticket')).toHaveLength(1);
    expect(mentions[0]!.value).toBe('4567');
  });
});

// ---------------------------------------------------------------------------
// Phase 2 n-gram phrase cap
// ---------------------------------------------------------------------------

describe('extractNgramPhrases phrase cap', () => {
  it('caps the phrase list at 5 for a 20-word sentence', () => {
    // 20 non-stopword tokens so the raw n-gram count is well above 5
    const sentence = Array.from({ length: 20 }, (_, i) => `alpha${i}`).join(' ');
    const phrases = extractNgramPhrases(sentence);
    expect(phrases.length).toBeLessThanOrEqual(5);
  });

  it('prefers longer phrases when capping', () => {
    const sentence = 'north america enterprise accounts contract renewal cycle';
    const phrases = extractNgramPhrases(sentence);
    expect(phrases.length).toBeLessThanOrEqual(5);
    // Longest phrase should be 6 words
    const lengths = phrases.map((p) => p.split(' ').length);
    expect(Math.max(...lengths)).toBe(6);
  });

  it('drops phrases that start or end with a stopword', () => {
    const phrases = extractNgramPhrases('the acme deal is the big one');
    for (const p of phrases) {
      const tokens = p.toLowerCase().split(' ');
      expect(['the', 'is']).not.toContain(tokens[0]);
      expect(['the', 'is']).not.toContain(tokens[tokens.length - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 1 / Phase 2 pipeline tests (full handler via mocked fetch)
// ---------------------------------------------------------------------------

const logger = pino({ level: 'silent' });

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

interface RegisteredTool {
  name: string;
  description: string;
  schema: unknown;
  handler: ToolHandler;
}

function createMockServer(): {
  server: McpServer;
  tools: Map<string, RegisteredTool>;
} {
  const tools = new Map<string, RegisteredTool>();
  const server = {
    tool: (
      name: string,
      description: string,
      schema: unknown,
      handler: ToolHandler,
    ) => {
      tools.set(name, { name, description, schema, handler });
    },
  } as unknown as McpServer;
  return { server, tools };
}

/**
 * URL-based mock fetch dispatcher. Routes a request to a handler whose
 * matcher returns true for the given URL. Unhandled URLs return an empty
 * `{ data: [] }` 200 so Promise.allSettled Phase 2 branches do not
 * accidentally surface noisy errors.
 */
interface RouteHandler {
  match: (url: string) => boolean;
  respond: (url: string) => { ok: boolean; status: number; body: unknown };
}

function installFetchRouter(routes: RouteHandler[]): ReturnType<typeof vi.fn> {
  const mock = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : String(input);
    for (const r of routes) {
      if (r.match(url)) {
        const { ok, status, body } = r.respond(url);
        return {
          ok,
          status,
          json: async () => body,
        } as Response;
      }
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as Response;
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

const UUID_TASK = '550e8400-e29b-41d4-a716-446655440001';
const UUID_USER = '550e8400-e29b-41d4-a716-446655440002';
const UUID_COMPANY_A = '550e8400-e29b-41d4-a716-446655440003';
const UUID_COMPANY_B = '550e8400-e29b-41d4-a716-446655440004';

const APP_URLS = {
  bondApiUrl: 'http://localhost:4009',
  briefApiUrl: 'http://localhost:4005',
  helpdeskApiUrl: 'http://localhost:4001',
};

describe('resolve_references handler', () => {
  let tools: Map<string, RegisteredTool>;
  let api: ApiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new ApiClient('http://localhost:4000', 'test-token', logger);
    const mock = createMockServer();
    tools = mock.tools;
    registerResolveTools(mock.server, api, APP_URLS);
  });

  function getTool(name: string): RegisteredTool {
    const t = tools.get(name);
    if (!t) throw new Error(`Tool "${name}" not registered`);
    return t;
  }

  it('registers resolve_references with a description', () => {
    expect(tools.has('resolve_references')).toBe(true);
    expect(tools.get('resolve_references')!.description).toMatch(/resolve/i);
  });

  it('pinned mention: "Check [[ABC-42]] and @jane" returns two pinned candidates', async () => {
    installFetchRouter([
      {
        match: (u) => u.includes('/tasks/by-ref/ABC-42'),
        respond: () => ({
          ok: true,
          status: 200,
          body: { id: UUID_TASK, human_id: 'ABC-42', title: 'Fix login' },
        }),
      },
      {
        match: (u) => u.includes('/users/search') && u.includes('q=jane'),
        respond: () => ({
          ok: true,
          status: 200,
          body: {
            data: [
              { id: UUID_USER, email: 'jane@example.com', display_name: 'Jane Doe' },
            ],
          },
        }),
      },
    ]);

    const result = await getTool('resolve_references').handler({
      text: 'Check [[ABC-42]] and @jane',
    });
    const parsed = JSON.parse(result.content[0]!.text) as {
      candidates: Array<{
        entity_type: string;
        entity_id: string;
        match_source: string;
        confidence: number;
        source_fragment: string;
      }>;
      unresolved_fragments: string[];
    };

    const pinned = parsed.candidates.filter((c) => c.match_source === 'pinned');
    expect(pinned.length).toBeGreaterThanOrEqual(2);
    expect(pinned.every((c) => c.confidence === 1.0)).toBe(true);

    const types = pinned.map((c) => c.entity_type).sort();
    expect(types).toContain('task');
    expect(types).toContain('user');
  });

  it('ambiguous phrase: two companies match, carries a disambiguation hint', async () => {
    installFetchRouter([
      {
        // Bond companies search for any phrase containing Acme returns
        // two near-tied hits. The resolver fans out multi-word n-grams,
        // so we match on the segment that identifies this endpoint.
        match: (u) => u.includes('/companies/search'),
        respond: () => ({
          ok: true,
          status: 200,
          body: {
            data: [
              {
                id: UUID_COMPANY_A,
                name: 'Acme Inc',
                owner_name: 'Alice Smith',
              },
              {
                id: UUID_COMPANY_B,
                name: 'Acme Rockets',
                owner_name: 'Bob Jones',
              },
            ],
          },
        }),
      },
    ]);

    const out = await resolveReferences(
      'Acme rocket division launch plan',
      api,
      APP_URLS,
    );
    const companies = out.candidates.filter((c) => c.entity_type === 'company');

    expect(companies.length).toBeGreaterThanOrEqual(2);
    // At least one company candidate carries a disambiguation hint (owner name)
    const withHint = companies.filter((c) => !!c.disambiguation);
    expect(withHint.length).toBeGreaterThanOrEqual(1);
    expect(withHint[0]!.disambiguation).toMatch(/owner/i);
  });

  it('unresolvable fragment: populates unresolved_fragments with nothing else', async () => {
    installFetchRouter([]); // every URL returns empty `{ data: [] }`

    const out = await resolveReferences(
      'the thing about the other thing',
      api,
      APP_URLS,
    );
    expect(out.candidates).toHaveLength(0);
    // Every token in the input is a stopword, so no n-gram phrases pass
    // the first/last-non-stopword filter. The resolver's "nothing matched
    // anywhere" fallback surfaces the trimmed remainder instead.
    expect(out.unresolved_fragments.length).toBeGreaterThan(0);
    expect(out.unresolved_fragments.join(' ')).toContain('thing');
  });

  it('pinned mention that fails to resolve appears in unresolved_fragments', async () => {
    installFetchRouter([
      {
        match: (u) => u.includes('/tasks/by-ref/XYZ-999'),
        respond: () => ({
          ok: false,
          status: 404,
          body: { error: 'not found' },
        }),
      },
    ]);

    const out = await resolveReferences('Check [[XYZ-999]]', api, APP_URLS);
    expect(out.candidates).toHaveLength(0);
    expect(out.unresolved_fragments).toContain('[[XYZ-999]]');
  });

  it('mention syntax helpers round-trip: stripPinnedMentions removes matched spans', () => {
    const text = 'Check [[ABC-42]] and @jane and [[deal:Acme]] tomorrow';
    const stripped = stripPinnedMentions(text);
    expect(stripped).not.toMatch(/\[\[ABC-42\]\]/);
    expect(stripped).not.toMatch(/@jane/);
    expect(stripped).not.toMatch(/\[\[deal:Acme\]\]/);
    expect(stripped).toMatch(/tomorrow/);
  });
});

// ---------------------------------------------------------------------------
// Response schema shape
// ---------------------------------------------------------------------------

describe('resolve_references response schema', () => {
  it('sorts candidates by confidence descending and caps at 50', async () => {
    installFetchRouter([
      {
        match: (u) => u.includes('/tasks/search'),
        respond: () => ({
          ok: true,
          status: 200,
          body: {
            data: Array.from({ length: 60 }, (_, i) => ({
              id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
              title: `Task ${i}`,
              human_id: `BULK-${i}`,
            })),
          },
        }),
      },
    ]);

    const api = new ApiClient('http://localhost:4000', 'test-token', logger);
    const out = await resolveReferences('acme deal large contract', api, APP_URLS);
    expect(out.candidates.length).toBeLessThanOrEqual(50);
    for (let i = 1; i < out.candidates.length; i += 1) {
      expect(out.candidates[i - 1]!.confidence).toBeGreaterThanOrEqual(
        out.candidates[i]!.confidence,
      );
    }
  });
});
