# Development Guide

This guide covers everything you need to contribute to BigBlueBam, from environment setup to code style conventions.

---

## Development Environment Setup

### Prerequisites

- **Node.js 22 LTS** or later
- **pnpm 9+** (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Docker** and **Docker Compose** (for data services and integration tests)
- A code editor with TypeScript support (VS Code recommended)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/bigblueceiling/BigBlueBam.git
cd BigBlueBam

# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your local secrets

# Start data services (PostgreSQL, Redis, MinIO)
docker compose up -d postgres redis minio

# Build shared packages
pnpm --filter @bigbluebam/shared build

# Run database migrations
pnpm db:migrate

# Start all apps in dev mode
pnpm dev
```

This starts:
- API server on `http://localhost:4000` internally (proxied at `http://localhost/b3/api/` in production, direct access in dev)
- Frontend on `http://localhost:5173` (Vite HMR in dev) or `http://localhost/b3/` (production nginx)
- Helpdesk portal at `http://localhost/helpdesk/` (production nginx)
- MCP server on `http://localhost:3001` internally (proxied at `http://localhost/mcp/`)
- Worker process (with hot reload)

In production, all services are accessed through a single nginx container on port 80. In dev mode, you can access the Vite dev server directly on port 5173 or the API on port 4000.

### Alternative: Full Docker Dev Mode

If you prefer everything in Docker:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## Monorepo Structure and Turborepo

BigBlueBam uses **Turborepo** for task orchestration across the monorepo. The pipeline is defined in `turbo.json`.

```mermaid
graph TD
    subgraph "Turborepo Pipeline"
        Build["build<br/><i>depends on ^build</i>"]
        Dev["dev<br/><i>persistent, no cache</i>"]
        Lint["lint<br/><i>depends on ^build</i>"]
        Type["typecheck<br/><i>depends on ^build</i>"]
        Test["test<br/><i>depends on ^build</i>"]
        Clean["clean<br/><i>no cache</i>"]
    end

    Shared["@bigbluebam/shared<br/>(built first)"]
    Shared --> Build
    Shared --> Lint
    Shared --> Type
    Shared --> Test
```

### Key Commands

| Command | Description |
|---|---|
| `pnpm build` | Build all packages (shared first, then apps) |
| `pnpm dev` | Start all apps in development mode |
| `pnpm lint` | Run ESLint + Biome across all packages |
| `pnpm typecheck` | Run `tsc --noEmit` across all packages |
| `pnpm test` | Run all tests (Vitest) |
| `pnpm test:unit` | Run unit tests only |
| `pnpm format` | Format all files with Biome |
| `pnpm check` | Biome check with auto-fix |

### Filtering

Run commands for a specific package:

```bash
pnpm --filter @bigbluebam/api build
pnpm --filter @bigbluebam/frontend dev
pnpm --filter @bigbluebam/shared test
```

---

## Adding a New API Endpoint

Step-by-step guide for adding a new endpoint to the API.

### Step 1: Define the Zod Schema

Add request/response schemas to the shared package so they can be reused by the frontend.

**File:** `packages/shared/src/schemas/your-feature.ts`

```typescript
import { z } from 'zod';

export const createWidgetSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  project_id: z.string().uuid(),
});

export type CreateWidgetInput = z.infer<typeof createWidgetSchema>;

export const widgetSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  project_id: z.string().uuid(),
  created_at: z.string().datetime(),
});

export type Widget = z.infer<typeof widgetSchema>;
```

Export from the package index: `packages/shared/src/index.ts`.

### Step 2: Define the Database Schema

**File:** `apps/api/src/db/schema/widgets.ts`

```typescript
import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const widgets = pgTable('widgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  project_id: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

Then export from `apps/api/src/db/schema/index.ts`.

### Step 3: Generate and Apply Migration

```bash
pnpm db:generate    # Creates SQL migration file
pnpm db:migrate     # Applies it to the database
```

### Step 4: Create the Service Layer

**File:** `apps/api/src/services/widget.service.ts`

```typescript
import { db } from '../db';
import { widgets } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { CreateWidgetInput } from '@bigbluebam/shared';

export async function createWidget(input: CreateWidgetInput, userId: string) {
  const [widget] = await db.insert(widgets).values(input).returning();
  return widget;
}

export async function getWidgetsByProject(projectId: string) {
  return db.select().from(widgets).where(eq(widgets.projectId, projectId));
}
```

### Step 5: Create the Route Handler

**File:** `apps/api/src/routes/widget.routes.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { widgets } from '../db/schema/widgets.js';
import { requireAuth } from '../plugins/auth.js';
import { eq } from 'drizzle-orm';

export default async function widgetRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    '/projects/:id/widgets',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const result = await db
        .select()
        .from(widgets)
        .where(eq(widgets.project_id, request.params.id));
      return reply.send({ data: result });
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/projects/:id/widgets',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const schema = z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
      });
      const input = schema.parse(request.body);
      const [widget] = await db
        .insert(widgets)
        .values({ ...input, project_id: request.params.id })
        .returning();
      return reply.status(201).send({ data: widget });
    },
  );
}
```

### Step 6: Register the Route

In `apps/api/src/server.ts`, import and register the new route plugin:

```typescript
import widgetRoutes from './routes/widget.routes.js';
// ... in the setup section:
fastify.register(widgetRoutes, { prefix: '/v1' });
```

### Step 7: Add Tests

**File:** `apps/api/src/routes/widget.routes.test.ts`

Write unit tests with Vitest and integration tests that hit the actual endpoint.

---

## Adding a New MCP Tool

### Step 1: Create the Tool Handler

**File:** `apps/mcp-server/src/tools/list-widgets.ts`

```typescript
import { z } from 'zod';
import type { ToolHandler } from '../types';

export const listWidgetsTool: ToolHandler = {
  name: 'list_widgets',
  description: 'List all widgets in a project.',
  inputSchema: z.object({
    project_id: z.string().uuid().describe('The project UUID'),
  }),
  requiredScope: 'read',
  handler: async (input, context) => {
    const response = await context.api.get(
      `/v1/projects/${input.project_id}/widgets`
    );
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  },
};
```

### Step 2: Register in the Tool Registry

In `apps/mcp-server/src/tools/index.ts`, add the tool to the registry:

```typescript
import { listWidgetsTool } from './list-widgets';

export const tools = [
  // ...existing tools
  listWidgetsTool,
];
```

### Step 3: Test the Tool

Use the MCP Inspector or a Claude Desktop connection to verify the tool appears and works correctly.

---

## Adding a New Frontend Component

### Step 1: Create the Component

**File:** `apps/frontend/src/features/widgets/WidgetList.tsx`

```tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

interface WidgetListProps {
  projectId: string;
}

export function WidgetList({ projectId }: WidgetListProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['widgets', projectId],
    queryFn: () => api.get(`/projects/${projectId}/widgets`),
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading widgets</div>;

  return (
    <ul>
      {data?.data.map((widget) => (
        <li key={widget.id}>{widget.name}</li>
      ))}
    </ul>
  );
}
```

### Step 2: Add API Hook (Optional)

For reusability, create a dedicated query hook:

**File:** `apps/frontend/src/api/hooks/useWidgets.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';

export function useWidgets(projectId: string) {
  return useQuery({
    queryKey: ['widgets', projectId],
    queryFn: () => api.get(`/projects/${projectId}/widgets`),
  });
}

export function useCreateWidget(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post(`/projects/${projectId}/widgets`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['widgets', projectId] });
    },
  });
}
```

### Step 3: Add Route (if needed)

Register the new view in the router configuration.

### Notable UI Components

The frontend includes several reusable components in `apps/frontend/src/components/common/`:

- **`CommandPalette`** -- Global command palette (Cmd+K / Ctrl+K) for quick navigation and actions
- **`KeyboardShortcutsOverlay`** -- Displays available keyboard shortcuts (toggled with `?`)
- **`DatePicker`** -- Date picker component used for due dates, sprint dates, etc.
- **`Dialog`**, **`DropdownMenu`**, **`Select`** -- Radix UI-based primitives styled with TailwindCSS

Custom hooks in `apps/frontend/src/hooks/`:

- **`useKeyboardShortcuts`** -- Registers and manages keyboard shortcut bindings
- **`useRealtime`** -- WebSocket connection for live board updates
- **`useReducedMotion`** -- Respects user's motion preferences for animations

---

## Database Migrations with Drizzle

### Workflow

```mermaid
graph LR
    A["Edit schema/*.ts"] --> B["pnpm db:generate"]
    B --> C["Review migration SQL"]
    C --> D["pnpm db:migrate<br/>(or docker compose run --rm migrate)"]
    D --> E["Verify changes"]
```

### Commands

```bash
# Generate migration from schema changes
pnpm db:generate

# Push schema directly (dev only, skips migration file)
pnpm db:push

# Apply pending migrations
pnpm db:migrate
# or
docker compose run --rm migrate
```

### Best Practices

1. **One logical change per migration.** Do not combine unrelated schema changes.
2. **Never edit an applied migration.** Create a new one instead.
3. **Add indexes concurrently** for production: `CREATE INDEX CONCURRENTLY ...`
4. **Test on a production data copy** before applying to production.

---

## Testing Strategy

### Test Types

| Type | Tool | Location | Command |
|---|---|---|---|
| **Unit tests** | Vitest | `*.test.ts` alongside source (~315 test files, 439 tests) | `pnpm test:unit` |
| **Integration tests** | Vitest + Docker Compose | `*.integration.test.ts` | `pnpm test` |
| **E2E tests** | Playwright (future) | `apps/frontend/e2e/` | `pnpm test:e2e` |

### Unit Tests

Test individual functions, services, and components in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { createWidgetSchema } from '@bigbluebam/shared';

describe('createWidgetSchema', () => {
  it('accepts valid input', () => {
    const result = createWidgetSchema.safeParse({
      name: 'My Widget',
      project_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createWidgetSchema.safeParse({
      name: '',
      project_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(false);
  });
});
```

### Integration Tests

Spin up a Docker Compose stack with real PostgreSQL and Redis:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestApp } from '../test-utils';
import type { FastifyInstance } from 'fastify';

describe('Widget API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates and lists widgets', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/projects/test-project/widgets',
      payload: { name: 'Test Widget' },
      headers: { authorization: 'Bearer test-key' },
    });
    expect(createRes.statusCode).toBe(201);

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/projects/test-project/widgets',
      headers: { authorization: 'Bearer test-key' },
    });
    expect(listRes.json().data).toHaveLength(1);
  });
});
```

---

## Code Style

### Biome (Formatter + Linter)

BigBlueBam uses [Biome](https://biomejs.dev/) for formatting and linting. Configuration is in `biome.json` at the repository root.

```bash
# Format all files
pnpm format

# Check and auto-fix
pnpm check
```

### Key Rules

- **Indentation:** 2 spaces
- **Semicolons:** Always
- **Quotes:** Single quotes for JS/TS, double quotes for JSX attributes
- **Trailing commas:** ES5 (objects, arrays, function parameters)
- **Line length:** 100 characters soft limit
- **Imports:** Sorted automatically by Biome

### TypeScript

- Enable `strict` mode in all `tsconfig.json` files
- Use explicit return types on exported functions
- Prefer `interface` over `type` for object shapes
- Use `unknown` over `any`

### ESLint

ESLint is used alongside Biome for TypeScript-specific rules. Run with:

```bash
pnpm lint
```

---

## Git Workflow

### Branch Naming

```
feature/BBB-123-add-dark-mode
bugfix/BBB-456-fix-card-drag
chore/update-dependencies
docs/add-api-reference
```

Format: `<type>/<task-id>-<short-description>`

### Development Workflow

```mermaid
graph LR
    Main["main<br/>(production)"]
    Feature["feature/BBB-123"]
    PR["Pull Request"]
    CI["CI Pipeline"]
    Staging["staging deploy"]

    Main -->|"branch"| Feature
    Feature -->|"push"| CI
    CI -->|"passes"| PR
    PR -->|"review + approve"| Main
    Main -->|"auto-deploy"| Staging
    Staging -->|"tag v*"| Prod["production deploy"]
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(api): add widget CRUD endpoints

Implements GET/POST/PATCH/DELETE for widgets with
Zod validation and RBAC middleware.

Refs: BBB-123
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `ci`

### Pull Request Process

1. Create a feature branch from `main`
2. Make changes and push
3. CI runs automatically (lint, typecheck, unit tests)
4. Open a PR with a clear description of changes
5. Request review from at least one team member
6. Integration tests run on the PR
7. After approval and green CI, merge to `main`
8. Auto-deploy to staging
9. Tag for production release when ready

### Rules

- All PRs must pass CI before merging
- Squash merge is preferred for feature branches
- Keep PRs focused and reviewable (under 500 lines when possible)
- Update relevant documentation with code changes
