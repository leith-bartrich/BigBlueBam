# MCP Server Documentation

BigBlueBam exposes a **Model Context Protocol (MCP)** server, enabling any MCP-compatible AI client to interact with project data through structured tool calls. The MCP server is a first-class citizen of the architecture, not a bolt-on.

---

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io) is an open standard for connecting AI assistants to external tools and data sources. MCP provides a structured way for AI clients (Claude Desktop, Claude Code, IDE extensions, custom agents) to:

- **Call tools** -- execute actions like creating tasks, moving cards, or closing sprints
- **Read resources** -- pull project data into the AI's context window
- **Use prompts** -- leverage pre-built prompt templates for common workflows

BigBlueBam's MCP server means you can manage your projects through natural language conversation with an AI assistant.

---

## Architecture

```mermaid
graph LR
    subgraph "AI Clients"
        Claude["Claude Desktop"]
        Code["Claude Code"]
        IDE["IDE Extension"]
        Agent["Custom Agent"]
    end

    subgraph "BigBlueBam MCP Server (proxied at /mcp/)"
        Transport["Transport Layer<br/>(Streamable HTTP / SSE / stdio)"]
        Auth["Auth Middleware<br/>(API key validation)"]
        Rate["Rate Limiter"]
        Audit["Audit Logger"]
        Tools["Tool Registry<br/>(86 tools: 42 BBB + 44 Banter)"]
        Resources["Resource Registry<br/>(BBB + Banter resources)"]
        Prompts["Prompt Registry<br/>(8 prompts)"]
    end

    subgraph "BigBlueBam Core"
        API["API Server (:4000)"]
        BanterAPI["Banter API (:4002)"]
        DB["PostgreSQL"]
        Redis["Redis"]
    end

    Claude -->|"SSE / HTTP"| Transport
    Code -->|"stdio / HTTP"| Transport
    IDE -->|"SSE"| Transport
    Agent -->|"HTTP"| Transport

    Transport --> Auth
    Auth --> Rate
    Rate --> Tools
    Rate --> Resources
    Rate --> Prompts

    Tools -->|"Internal HTTP"| API
    Tools -->|"Internal HTTP"| BanterAPI
    Resources -->|"Internal HTTP"| API
    Resources -->|"Internal HTTP"| BanterAPI
    Prompts -->|"Internal HTTP"| API
    Prompts -->|"Internal HTTP"| BanterAPI
    Audit -->|"Log"| Redis
    API --> DB
    BanterAPI --> DB
```

### Transport Options

| Transport | Use Case | Configuration |
|---|---|---|
| **Streamable HTTP** | Cloud deployments, remote clients | Primary, recommended |
| **SSE** | Backward compatibility, web-based clients | Supported |
| **stdio** | Local CLI/IDE integrations, Docker exec | Available |

### SDK

Built with the official `@modelcontextprotocol/sdk` TypeScript package. Runs as a sidecar Docker container on internal port 3001, exposed externally at `/mcp/` through the shared nginx reverse proxy on port 80. Communicates with the API server over the internal Docker network.

---

## Authentication

### API Key Authentication

The primary authentication method. Clients include their BigBlueBam API key in the initial HTTP request:

```
Authorization: Bearer bbam_your_api_key_here
```

The API key's scope determines available tools:

| Scope | Available Tools |
|---|---|
| `read` | All query/list tools only |
| `read_write` | All tools except configuration changes |
| `admin` | All tools including project configuration |

### OAuth 2.1 Flow

For cloud-hosted MCP endpoints, the server supports OAuth 2.1 with PKCE per the MCP specification:

```mermaid
sequenceDiagram
    participant Client as AI Client
    participant MCP as MCP Server
    participant Auth as Auth Server

    Client->>MCP: Initial connection (no token)
    MCP-->>Client: 401 + OAuth metadata URL
    Client->>Auth: Authorization request (PKCE)
    Auth-->>Client: Authorization code
    Client->>Auth: Token exchange (code + verifier)
    Auth-->>Client: Access token
    Client->>MCP: Reconnect with Bearer token
    MCP->>MCP: Validate token, establish session
    MCP-->>Client: Session ready
```

### Security Properties

| Property | Implementation |
|---|---|
| **Session binding** | Each MCP session is bound to a single authenticated user. All tool calls use that user's permissions. |
| **Input validation** | Every tool input is validated against a Zod schema before execution. |
| **Output sanitization** | Responses are stripped of internal IDs, stack traces, and infrastructure details. |
| **Rate limiting** | Shared pool with REST API. MCP calls count against the same per-user and per-org limits. |
| **Audit logging** | Every tool invocation is logged to `activity_log` with action prefixed `mcp.` for traceability. |
| **Destructive action confirmation** | Tools that delete, close, or remove require a two-step confirmation with time-limited action tokens. |

---

## Available Tools (38 total)

### Project Tools

| Tool | Description | Scope |
|---|---|---|
| `list_projects` | List all accessible projects | read |
| `get_project` | Get full project details including phases, states, active sprint | read |
| `create_project` | Create a new project with optional template | read_write |

### Board and Phase Tools

| Tool | Description | Scope |
|---|---|---|
| `get_board` | Retrieve full board state for a project's active sprint | read |
| `list_phases` | List phases with configuration details | read |
| `create_phase` | Add a new board column | admin |
| `reorder_phases` | Set display order of all phases | admin |

### Sprint Tools

| Tool | Description | Scope |
|---|---|---|
| `list_sprints` | List sprints with status and point totals | read |
| `create_sprint` | Create a new sprint | read_write |
| `start_sprint` | Activate a planned sprint | read_write |
| `complete_sprint` | Complete active sprint with carry-forward (requires confirmation) | read_write |
| `get_sprint_report` | Retrieve velocity, burndown, completion data | read |

### Task Tools

| Tool | Description | Scope |
|---|---|---|
| `search_tasks` | Search and filter tasks with full-text search | read |
| `get_task` | Get full task detail (by UUID or human ID like "BBB-142") | read |
| `create_task` | Create a new task with all fields | read_write |
| `update_task` | Partial update of task fields | read_write |
| `move_task` | Move task to different phase/sprint | read_write |
| `delete_task` | Soft-delete a task (requires confirmation) | read_write |
| `bulk_update_tasks` | Apply same changes to multiple tasks | read_write |
| `log_time` | Log time spent on a task | read_write |
| `duplicate_task` | Duplicate an existing task, optionally including subtasks | read_write |

### Comment Tools

| Tool | Description | Scope |
|---|---|---|
| `list_comments` | List comments on a task | read |
| `add_comment` | Post a comment on a task | read_write |

### Member Tools

| Tool | Description | Scope |
|---|---|---|
| `list_members` | List project or org members with roles | read |
| `get_my_tasks` | Get all tasks assigned to the authenticated user | read |

### Import Tools

| Tool | Description | Scope |
|---|---|---|
| `import_csv` | Import tasks from CSV data into a project | read_write |
| `import_github_issues` | Import GitHub issues into a project as tasks | read_write |
| `suggest_branch_name` | Generate a git branch name from a task (e.g., `feature/BBB-42-design-login-screen`) | read |

### Template Tools

| Tool | Description | Scope |
|---|---|---|
| `list_templates` | List available task templates for a project | read |
| `create_from_template` | Create a task from a template with optional field overrides | read_write |

### Reporting Tools

| Tool | Description | Scope |
|---|---|---|
| `get_velocity_report` | Sprint-over-sprint velocity data | read |
| `get_burndown` | Burndown chart data for a sprint | read |
| `get_cumulative_flow` | Cumulative flow diagram data | read |
| `get_overdue_tasks` | Report of all overdue tasks in a project | read |
| `get_workload` | Workload distribution (task counts and story points per team member) | read |
| `get_status_distribution` | Task counts per phase and status | read |

### Utility Tools

| Tool | Description | Scope |
|---|---|---|
| `confirm_action` | Confirm a staged destructive action (60s token, single-use) | read_write |
| `get_server_info` | Instance version, authenticated user, available tools (38), rate limit status | read |

---

## Available Resources

Resources provide read-only data that AI clients can pull into their context window.

| URI Pattern | Description |
|---|---|
| `bigbluebam://projects` | List of all accessible projects |
| `bigbluebam://projects/{id}/board` | Current board state |
| `bigbluebam://projects/{id}/backlog` | All backlog tasks |
| `bigbluebam://sprints/{id}` | Sprint details + task list |
| `bigbluebam://tasks/{human_id}` | Full task detail (by human-readable ID, e.g., `BBB-142`) |
| `bigbluebam://me/tasks` | Current user's task list across all projects |
| `bigbluebam://me/notifications` | Unread notifications |

---

## Available Prompts

Pre-built prompt templates for common AI workflows.

| Prompt | Arguments | Description |
|---|---|---|
| `sprint_planning` | `project_id` | Fetches backlog, last 3 sprint velocities, team list. Guides AI through prioritization and scoping. |
| `daily_standup` | `project_id` | Fetches 24-hour activity log and in-progress tasks. Summarizes what happened and what is planned. |
| `sprint_retrospective` | `sprint_id` | Fetches sprint report, carry-forward history, scope changes. Structures "went well / improve / action items". |
| `task_breakdown` | `task_id` | Fetches task detail and similar historical tasks. Helps break epics into smaller subtasks with estimates. |

---

## Configuration

The MCP server is configured via environment variables:

| Variable | Default | Description |
|---|---|---|
| `MCP_ENABLED` | `true` | Enable/disable the MCP server |
| `MCP_TRANSPORT` | `streamable-http` | Transport: `streamable-http`, `sse`, `stdio` |
| `MCP_PORT` | `3001` | Port for MCP server (sidecar mode) |
| `MCP_PATH` | `/mcp` | URL path prefix (integrated mode) |
| `MCP_AUTH_REQUIRED` | `true` | Require authentication (disable only for local dev) |
| `MCP_RATE_LIMIT_RPM` | `100` | Requests per minute per session |
| `MCP_CONFIRM_DESTRUCTIVE` | `true` | Require confirmation for destructive actions |
| `MCP_MAX_RESULT_SIZE` | `50000` | Max characters in a single tool response |
| `MCP_AUDIT_LOG` | `true` | Log all MCP tool invocations to activity_log |
| `API_INTERNAL_URL` | `http://api:4000` | Internal URL for API server communication |
| `REDIS_URL` | (required) | Redis connection for session cache |

---

## Client Configuration Examples

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bigbluebam": {
      "url": "https://app.bigbluebam.io/mcp/sse",
      "headers": {
        "Authorization": "Bearer bbam_your_api_key_here"
      }
    }
  }
}
```

For a local Docker instance:

```json
{
  "mcpServers": {
    "bigbluebam": {
      "url": "http://localhost/mcp/sse",
      "headers": {
        "Authorization": "Bearer bbam_your_api_key_here"
      }
    }
  }
}
```

### Claude Code

Add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "bigbluebam": {
      "command": "npx",
      "args": [
        "@bigbluebam/mcp-server",
        "--api-url", "http://localhost/b3/api",
        "--api-key", "bbam_dev_key"
      ]
    }
  }
}
```

### Local Docker (stdio transport)

```json
{
  "mcpServers": {
    "bigbluebam": {
      "command": "docker",
      "args": [
        "exec", "-i", "bigbluebam-mcp-server-1",
        "node", "dist/mcp-stdio.js"
      ],
      "env": {
        "BIGBLUEBAM_API_KEY": "bbam_your_key"
      }
    }
  }
}
```

---

## Typical AI Workflow

```mermaid
sequenceDiagram
    participant User as User (via Claude)
    participant AI as Claude
    participant MCP as MCP Server

    User->>AI: "What's the status of our project?"
    AI->>MCP: list_projects
    MCP-->>AI: [{name: "BigBlueBam", active_sprint: "Sprint 12", open_tasks: 42}]
    AI->>MCP: get_board(project_id)
    MCP-->>AI: Board with 5 phases, 18 tasks in Sprint 12
    AI-->>User: "Sprint 12 has 18 tasks: 3 in Backlog, 5 in To Do, 3 In Progress, 2 in Review, 5 Done..."

    User->>AI: "Create a task for adding dark mode support"
    AI->>MCP: create_task(project_id, title: "Add dark mode support", priority: "medium")
    MCP-->>AI: {human_id: "BBB-156", title: "Add dark mode support"}
    AI-->>User: "Created BBB-156: Add dark mode support (medium priority, in Backlog)"

    User->>AI: "Add a comment about using CSS custom properties"
    AI->>MCP: add_comment(task_id, body: "Consider using CSS custom properties for theme variables...")
    MCP-->>AI: Comment added
    AI-->>User: "Comment added to BBB-156"

    User->>AI: "Show me all overdue tasks"
    AI->>MCP: search_tasks(project_id, due_date_before: "2026-04-02", priority: ["critical","high"])
    MCP-->>AI: 3 overdue tasks
    AI-->>User: "There are 3 overdue tasks: BBB-101 (critical, 5 days overdue)..."
```

---

## Destructive Action Confirmation

Tools that delete tasks, complete sprints, or remove members use a two-step confirmation flow:

```mermaid
sequenceDiagram
    participant AI as AI Client
    participant MCP as MCP Server

    AI->>MCP: delete_task(task_id: "uuid")
    MCP-->>AI: Confirmation required: "Delete BBB-142: Implement OAuth2 login flow?"
    Note right of MCP: Returns action_token<br/>(valid 60 seconds)

    alt AI confirms
        AI->>MCP: confirm_action(action_token: "tok_...")
        MCP-->>AI: Task deleted successfully
    else AI declines or token expires
        AI-->>AI: Action not taken
    end
```

This prevents accidental data loss from AI misinterpretation and gives the AI client (and its human user) a chance to review before irreversible actions execute.
