# Architecture Overview

BigBlueBam is a Docker-native monorepo application with a clear separation between application services (stateless, horizontally scalable) and data services (stateful, vertically scalable or replaceable with managed cloud equivalents).

---

## High-Level System Architecture

```mermaid
graph TB
    subgraph Clients
        Browser["Browser<br/>(React SPA)"]
        MobileWeb["Mobile Browser"]
        AIClient["AI Client<br/>(Claude Desktop,<br/>Claude Code, IDE)"]
    end

    subgraph "Docker Compose Stack"
        subgraph "Frontend Network"
            Nginx["frontend<br/>nginx + React SPA<br/>:80 / :443"]
        end

        subgraph "Application Layer"
            API["api<br/>Fastify v5<br/>REST + WebSocket<br/>:4000"]
            MCP["mcp-server<br/>MCP SDK (38 tools)<br/>SSE + Streamable HTTP<br/>:3001"]
            Worker["worker<br/>BullMQ<br/>Background Jobs<br/>(no exposed port)"]
        end

        subgraph "Data Layer"
            PG["postgres<br/>PostgreSQL 16<br/>:5432<br/>Vol: pgdata"]
            Redis["redis<br/>Redis 7<br/>:6379<br/>Vol: redisdata"]
            MinIO["minio<br/>S3-Compatible<br/>:9000 / :9001<br/>Vol: miniodata"]
        end
    end

    Browser -->|"HTTPS"| Nginx
    MobileWeb -->|"HTTPS"| Nginx
    Nginx -->|"Reverse Proxy"| API
    Browser -->|"WSS"| API
    AIClient -->|"SSE / Streamable HTTP"| MCP

    MCP -->|"Internal HTTP"| API
    API -->|"SQL"| PG
    API -->|"Cache / PubSub / Sessions"| Redis
    API -->|"Presigned URLs"| MinIO
    API -->|"Enqueue Jobs"| Redis

    Worker -->|"SQL"| PG
    Worker -->|"Dequeue Jobs"| Redis
    Worker -->|"Upload/Delete"| MinIO
```

---

## Monorepo Structure

BigBlueBam uses **Turborepo** for task orchestration and **pnpm workspaces** for dependency management.

```
BigBlueBam/
|-- apps/
|   |-- api/              Fastify REST API + WebSocket server (~63 source files)
|   |   |-- src/
|   |   |   |-- routes/       23 route files grouped by domain
|   |   |   |-- services/     Business logic layer (auth, org, project, task, activity, realtime)
|   |   |   |-- db/
|   |   |   |   |-- schema/   24 Drizzle table definitions
|   |   |   |   +-- migrations/
|   |   |   |-- middleware/   Auth (authorize.ts), error handling
|   |   |   |-- plugins/      Fastify plugin registrations
|   |   |   |-- utils/        Shared utilities
|   |   |   |-- cli.ts        CLI commands (create-admin)
|   |   |   |-- server.ts     Entry point
|   |   |   +-- migrate.ts    Migration runner
|   |   |-- Dockerfile
|   |   +-- package.json
|   |
|   |-- frontend/         React SPA (~55 source files)
|   |   |-- src/
|   |   |   |-- components/
|   |   |   |   |-- auth/       Login/register forms
|   |   |   |   |-- board/      Board view, phase columns, task cards, filter bar, swimlanes, saved views
|   |   |   |   |-- common/     Reusable UI: Button, Dialog, DatePicker, CommandPalette, KeyboardShortcutsOverlay
|   |   |   |   |-- import/     Import dialog (CSV, Trello, Jira, GitHub)
|   |   |   |   |-- layout/     AppLayout, Sidebar
|   |   |   |   |-- tasks/      Task detail drawer, create dialog, template manager/picker
|   |   |   |   +-- views/      Calendar, List, Timeline, Workload views
|   |   |   |-- hooks/        useKeyboardShortcuts, useProjects, useRealtime, useSprints, useTasks, useReducedMotion
|   |   |   |-- stores/       Zustand stores (auth, board)
|   |   |   |-- pages/        Dashboard, Board, MyWork, Settings, AuditLog, Login, Register
|   |   |   |-- lib/          Utilities, constants
|   |   |   +-- app.tsx       Root component
|   |   |-- Dockerfile
|   |   +-- package.json
|   |
|   |-- mcp-server/       Model Context Protocol server (38 tools)
|   |   |-- src/
|   |   |   |-- tools/        10 tool modules (project, board, sprint, task, comment, member, report, import, template, utility)
|   |   |   |-- resources/    7 MCP resource providers
|   |   |   |-- prompts/      4 prompt templates (sprint planning, standup, retro, task breakdown)
|   |   |   |-- middleware/    API client, rate limiter
|   |   |   +-- server.ts     Entry point
|   |   |-- Dockerfile
|   |   +-- package.json
|   |
|   +-- worker/           Background job processor
|       |-- src/
|       |   |-- jobs/         Job handlers (email, notification, export, sprint-close)
|       |   |-- utils/
|       |   +-- worker.ts     Entry point
|       |-- Dockerfile
|       +-- package.json
|
|-- packages/
|   +-- shared/           Shared code between all apps
|       |-- src/
|       |   |-- schemas/      Zod validation schemas
|       |   |-- types/        TypeScript type definitions
|       |   +-- constants/    Shared constants and enums
|       +-- package.json
|
|-- infra/
|   |-- postgres/         init.sql for database setup
|   |-- nginx/            nginx.conf, TLS certificates
|   +-- helm/             Kubernetes Helm chart
|       +-- bigbluebam/
|
|-- scripts/                  Utility scripts (seed-frndo.js)
|-- docker-compose.yml        Production stack (7 services + 1 migration one-shot)
|-- docker-compose.dev.yml    Development overrides
|-- turbo.json                Turborepo pipeline config
|-- pnpm-workspace.yaml       Workspace definitions
|-- biome.json                Formatter/linter config
+-- package.json              Root scripts
```

### Dependency Graph

```mermaid
graph LR
    Shared["@bigbluebam/shared<br/>(Zod schemas, types)"]
    API["@bigbluebam/api"]
    Frontend["@bigbluebam/frontend"]
    MCP["@bigbluebam/mcp-server"]
    Worker["@bigbluebam/worker"]

    API --> Shared
    Frontend --> Shared
    MCP --> Shared
    Worker --> Shared
    MCP -.->|"HTTP calls"| API
```

---

## Tech Stack Rationale

### Frontend

| Technology | Why |
|---|---|
| **React 19** | Concurrent rendering, transitions API, massive ecosystem, strong TypeScript support |
| **Motion (v11+)** | Spring-physics animations, layout animations for card reflow, drag gesture support |
| **TanStack Query v5** | Server state cache with optimistic updates, background refetching, infinite queries |
| **Zustand** | Minimal client-side state management without boilerplate (UI state, filter state) |
| **dnd-kit** | Accessible drag-and-drop with sortable lists and multi-container support |
| **TailwindCSS v4** | Utility-first CSS, design token support, fast iteration |
| **Radix UI** | Unstyled, accessible primitives (dialogs, dropdowns, tooltips) |
| **Tiptap** | ProseMirror-based rich text editor for task descriptions and comments |
| **React Hook Form + Zod** | Performant forms with shared validation schemas from `@bigbluebam/shared` |

### Backend

| Technology | Why |
|---|---|
| **Node.js 22 LTS** | TypeScript-native, shared language with frontend, large ecosystem |
| **Fastify v5** | High performance, schema-based validation, plugin architecture, excellent DX |
| **Drizzle ORM** | Type-safe, SQL-first ORM with excellent migration tooling |
| **Zod** | Runtime validation shared with frontend via `@bigbluebam/shared` |
| **Socket.IO / WebSocket** | Room-based real-time broadcasting with Redis PubSub for horizontal scaling |
| **BullMQ** | Redis-backed job queue for background processing (email, exports, analytics) |

### Data Layer

| Technology | Why |
|---|---|
| **PostgreSQL 16** | Row-level security, JSONB for custom fields, partitioning for activity logs, full-text search |
| **Redis 7** | Session store, cache, pub/sub backbone, BullMQ queue backend |
| **MinIO** | S3-compatible object storage, drop-in replacement for AWS S3/Cloudflare R2 |

---

## Data Flow Diagrams

### User Creates a Task

```mermaid
sequenceDiagram
    participant User as Browser Client
    participant API as API Server
    participant DB as PostgreSQL
    participant Redis as Redis
    participant WS as WebSocket Hub
    participant Others as Other Clients

    User->>User: Fill out task form
    User->>API: POST /projects/:id/tasks
    API->>API: Validate input (Zod schema)
    API->>API: Check RBAC permissions
    API->>DB: INSERT INTO tasks (generate human_id)
    DB-->>API: Task row with BBB-143
    API->>DB: INSERT INTO activity_log
    API->>Redis: PUBLISH project:{id} task.created
    API-->>User: 201 Created (full task object)
    User->>User: Optimistic update confirmed

    Redis-->>WS: Event: task.created
    WS->>Others: Broadcast to project room
    Others->>Others: Card appears on board (animated)
```

### Sprint Close with Carry-Forward Ceremony

```mermaid
sequenceDiagram
    participant Admin as Project Admin
    participant API as API Server
    participant DB as PostgreSQL
    participant Redis as Redis
    participant Worker as Worker
    participant Team as Team Members

    Admin->>API: POST /sprints/:id/complete
    API->>DB: Query incomplete tasks in sprint
    DB-->>API: 5 incomplete tasks
    API-->>Admin: Carry-forward dialog data

    Admin->>Admin: Select action per task
    Note right of Admin: 3x carry_forward<br/>1x backlog<br/>1x cancel

    Admin->>API: POST /sprints/:id/complete (with decisions)
    API->>DB: Snapshot velocity (completed points)
    API->>DB: Update sprint status = completed
    API->>DB: Update carried tasks (sprint_id, carry_forward_count++)
    API->>DB: Update backlog task (sprint_id = NULL)
    API->>DB: Update cancelled task (state = cancelled)
    API->>DB: Create sprint_tasks records (removal_reason)
    API->>DB: Lock sprint (read-only)
    API->>Redis: Enqueue sprint_report job
    Redis-->>Worker: Process sprint report
    Worker->>DB: Generate burndown, velocity data
    API->>Redis: PUBLISH sprint.completed event
    Redis-->>Team: Broadcast to all project members
    API-->>Admin: Sprint report summary
```

### MCP Tool Call Flow

```mermaid
sequenceDiagram
    participant AI as AI Client (Claude)
    participant MCP as MCP Server (:3001)
    participant Auth as Auth Middleware
    participant API as API Server (:4000)
    participant DB as PostgreSQL

    AI->>MCP: SSE connect with Bearer bbam_...
    MCP->>Auth: Validate API key
    Auth->>DB: Look up key hash, check scope
    DB-->>Auth: User context + permissions
    Auth-->>MCP: Session established

    AI->>MCP: tools/call: search_tasks
    MCP->>MCP: Validate input (Zod schema)
    MCP->>API: GET /projects/:id/tasks?search=...
    API->>DB: Full-text search query
    DB-->>API: Matching tasks
    API-->>MCP: JSON response
    MCP-->>AI: Tool result (formatted tasks)

    AI->>MCP: tools/call: create_task
    MCP->>MCP: Validate input, check write scope
    MCP->>API: POST /projects/:id/tasks
    API->>DB: INSERT task
    DB-->>API: New task
    API-->>MCP: 201 Created
    MCP-->>AI: Tool result (task created)

    AI->>MCP: tools/call: delete_task
    MCP->>MCP: Destructive action detected
    MCP-->>AI: Confirmation required (action_token)
    AI->>MCP: tools/call: confirm_action
    MCP->>API: DELETE /tasks/:id
    API->>DB: Soft-delete task
    API-->>MCP: 200 OK
    MCP-->>AI: Task deleted
```

---

## Container Architecture

```mermaid
graph TB
    subgraph "Network: frontend"
        FE["frontend<br/><i>nginx + React SPA</i><br/>Ports: 80, 443"]
        API2["api<br/>(also on frontend network)"]
        MCP2["mcp-server<br/>(also on frontend network)"]
    end

    subgraph "Network: backend"
        API["api<br/><i>Fastify v5 + WebSocket</i><br/>Port: 4000<br/>512MB RAM, 1 CPU"]
        MCP["mcp-server<br/><i>MCP SDK</i><br/>Port: 3001<br/>256MB RAM, 0.5 CPU"]
        Worker["worker<br/><i>BullMQ processor</i><br/>No exposed port<br/>512MB RAM, 1 CPU"]
        PG["postgres<br/><i>PostgreSQL 16-alpine</i><br/>Port: 5432<br/>1GB RAM, 1 CPU<br/>Volume: pgdata"]
        Redis["redis<br/><i>Redis 7-alpine</i><br/>Port: 6379<br/>256MB RAM, 0.25 CPU<br/>Volume: redisdata"]
        MinIO["minio<br/><i>MinIO latest</i><br/>Ports: 9000, 9001<br/>256MB RAM, 0.25 CPU<br/>Volume: miniodata"]
    end

    FE ---|"proxy /api/*"| API
    API -->|"SQL queries"| PG
    API -->|"sessions, cache, pubsub, queues"| Redis
    API -->|"presigned URLs"| MinIO
    MCP -->|"internal HTTP"| API
    MCP -->|"session cache"| Redis
    Worker -->|"SQL queries"| PG
    Worker -->|"dequeue jobs"| Redis
    Worker -->|"file operations"| MinIO

    style FE fill:#dbeafe,stroke:#2563eb
    style API fill:#dbeafe,stroke:#2563eb
    style MCP fill:#dbeafe,stroke:#2563eb
    style Worker fill:#dbeafe,stroke:#2563eb
    style PG fill:#d1fae5,stroke:#059669
    style Redis fill:#d1fae5,stroke:#059669
    style MinIO fill:#d1fae5,stroke:#059669
```

### Docker Networks

| Network | Services | Purpose |
|---|---|---|
| `frontend` | frontend, api, mcp-server | External-facing services |
| `backend` | api, mcp-server, worker, postgres, redis, minio | Internal service communication |

### Volumes

| Volume | Service | Contains |
|---|---|---|
| `pgdata` | postgres | Database files |
| `redisdata` | redis | AOF persistence |
| `miniodata` | minio | Uploaded attachments, avatars |

---

## Client Architecture

### React Component Hierarchy

```mermaid
graph TD
    App["App"]
    App --> AuthProvider["AuthProvider"]
    AuthProvider --> Router["Router"]
    Router --> MainLayout["MainLayout"]

    MainLayout --> Sidebar["Sidebar<br/>(project list, navigation)"]
    MainLayout --> TopBar["TopBar<br/>(search, notifications, user menu)"]
    MainLayout --> ContentArea["Content Area"]

    ContentArea --> BoardView["BoardView"]
    ContentArea --> ListView["ListView"]
    ContentArea --> TimelineView["TimelineView"]
    ContentArea --> CalendarView["CalendarView"]
    ContentArea --> MyWorkView["MyWorkView"]
    ContentArea --> SettingsView["SettingsView"]

    BoardView --> SprintHeader["SprintHeader<br/>(sprint selector, goal, progress)"]
    BoardView --> FilterBar["FilterBar<br/>(assignee, label, priority, search)"]
    BoardView --> PhaseColumns["PhaseColumns"]
    PhaseColumns --> PhaseColumn["PhaseColumn<br/>(header, WIP indicator)"]
    PhaseColumn --> TaskCard["TaskCard<br/>(drag source, card face)"]

    TaskCard --> TaskDetailDrawer["TaskDetailDrawer<br/>(slide-over panel)"]
    TaskDetailDrawer --> DescriptionEditor["DescriptionEditor<br/>(Tiptap)"]
    TaskDetailDrawer --> MetadataSidebar["MetadataSidebar<br/>(fields, pickers)"]
    TaskDetailDrawer --> SubtaskList["SubtaskList"]
    TaskDetailDrawer --> CommentThread["CommentThread"]
    TaskDetailDrawer --> ActivityFeed["ActivityFeed"]
    TaskDetailDrawer --> AttachmentZone["AttachmentZone"]
```

---

## State Management

BigBlueBam separates client state (UI concerns) from server state (API data).

```mermaid
graph LR
    subgraph "Server State (TanStack Query)"
        QC["QueryClient Cache"]
        QC --> Tasks["tasks"]
        QC --> Board["board"]
        QC --> Sprints["sprints"]
        QC --> Members["members"]
        QC --> Comments["comments"]
    end

    subgraph "Client State (Zustand)"
        UI["UI Store"]
        UI --> ActiveFilters["activeFilters"]
        UI --> SelectedCards["selectedCards"]
        UI --> DrawerState["drawerOpen / taskId"]
        UI --> ColumnWidths["columnWidths"]
        UI --> Theme["theme (light/dark)"]
    end

    subgraph "Interactions"
        DnD["dnd-kit DnD Context"]
        WS["WebSocket Events"]
    end

    WS -->|"invalidate queries"| QC
    WS -->|"optimistic update"| QC
    DnD -->|"optimistic move"| QC
    DnD -->|"API call"| API["API Server"]
    API -->|"confirmed data"| QC
    UI -->|"filter params"| QC
```

### How It Works

1. **TanStack Query** manages all API data. Queries are keyed by endpoint and parameters. Data is cached, background-refetched, and garbage-collected automatically.

2. **Zustand** stores hold UI-only state: which filters are active, which cards are selected, whether the detail drawer is open, column widths, and theme preference.

3. **Optimistic updates**: When a user drags a card, TanStack Query immediately updates the cache (card moves visually). The API call fires in the background. On success, the cache is updated with server-confirmed data. On failure, the cache rolls back and the card snaps back with a spring animation.

4. **WebSocket events** trigger query invalidation. When another user creates a task, the `task.created` event causes TanStack Query to refetch the board data, and the new card appears with an entrance animation.

---

## Real-Time Architecture

### WebSocket Rooms

```mermaid
graph TD
    subgraph "WebSocket Server (API)"
        Hub["Connection Hub"]
        Hub --> OrgRoom["Room: org:{org_id}"]
        Hub --> ProjRoom1["Room: project:{project_id_1}"]
        Hub --> ProjRoom2["Room: project:{project_id_2}"]
        Hub --> UserRoom1["Room: user:{user_id_1}"]
        Hub --> UserRoom2["Room: user:{user_id_2}"]
    end

    subgraph "Redis PubSub"
        RedisPub["Redis Channel per Room"]
    end

    subgraph "API Instance 2 (scaled)"
        Hub2["Connection Hub (replica)"]
    end

    Hub <-->|"subscribe/publish"| RedisPub
    Hub2 <-->|"subscribe/publish"| RedisPub
```

### Event Flow

When a user performs an action:

1. The API handles the REST request and writes to the database.
2. The API publishes an event to Redis PubSub on the appropriate channel (e.g., `project:{id}`).
3. All API instances subscribed to that channel receive the event.
4. Each API instance broadcasts the event to all WebSocket clients in the matching room.
5. Clients receive the event and update their local state (TanStack Query cache invalidation or direct cache update).

### Event Types

| Event | Room | Payload |
|---|---|---|
| `task.created` | `project:{id}` | Full task object |
| `task.updated` | `project:{id}` | Task ID + changed fields (delta) |
| `task.moved` | `project:{id}` | Task ID, old phase, new phase, new position |
| `task.deleted` | `project:{id}` | Task ID |
| `task.reordered` | `project:{id}` | Phase ID + ordered task IDs |
| `comment.added` | `project:{id}` | Comment object |
| `sprint.status_changed` | `project:{id}` | Sprint ID + new status |
| `phase.updated` | `project:{id}` | Phase object |
| `user.presence` | `project:{id}` | User ID + status (online/idle/offline) |
| `notification` | `user:{id}` | Notification object |

### Conflict Resolution

- **Field updates**: Last-write-wins with `updated_at` stale check. If the server detects a stale update (client's `updated_at` does not match), it returns HTTP 409. The client refetches and re-applies.
- **Board position conflicts**: When two users move cards simultaneously, the server determines the final position order and broadcasts an authoritative `task.reordered` event. Both clients reconcile with an animated reflow.
- **Presence indicators**: User avatars appear on task cards currently being edited by another user, with a colored ring and tooltip.
