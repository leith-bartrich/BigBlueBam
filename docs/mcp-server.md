# MCP Server Documentation

BigBlueBam exposes a **Model Context Protocol (MCP)** server, enabling any MCP-compatible AI client to interact with project data through structured tool calls. The MCP server is a first-class citizen of the architecture, not a bolt-on.

**111 tools: 47 Banter, 64 BBB (including helpdesk and platform)**

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
        Tools["Tool Registry<br/>(111 tools: 64 BBB + 47 Banter)"]
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

API keys are prefixed `bbam_`, stored as Argon2id hashes, and scoped to `read`, `read_write`, or `admin` with optional project restriction.

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

## Available Tools (111 total)

### Project Tools (5 tools) -- `project-tools.ts`

| Tool | Description | Permission |
|---|---|---|
| `list_projects` | List all projects the current user has access to | Any authenticated user |
| `get_project` | Get detailed information about a specific project | Any authenticated user |
| `create_project` | Create a new project | Any authenticated user |
| `test_slack_webhook` | Send a test message to a project's configured Slack webhook URL | Project admin/owner |
| `disconnect_github_integration` | Remove GitHub integration from a project (destructive - requires confirmation) | Project admin/owner |

### Board and Phase Tools (4 tools) -- `board-tools.ts`

| Tool | Description | Permission |
|---|---|---|
| `get_board` | Get the full board state for a project, including all phases and their tasks | Any authenticated user |
| `list_phases` | List all phases (columns) for a project | Any authenticated user |
| `create_phase` | Create a new phase (column) in a project board | Project admin/owner |
| `reorder_phases` | Reorder the phases (columns) on a project board | Project admin/owner |

### Sprint Tools (5 tools) -- `sprint-tools.ts`

| Tool | Description | Permission |
|---|---|---|
| `list_sprints` | List all sprints for a project | Any authenticated user |
| `create_sprint` | Create a new sprint for a project | Project admin/owner |
| `start_sprint` | Start a planned sprint | Project admin/owner |
| `complete_sprint` | Complete an active sprint | Project admin/owner |
| `get_sprint_report` | Get a sprint report with velocity, completion stats, and burndown data | Any authenticated user |

### Task Tools (10 tools) -- `task-tools.ts`

| Tool | Description | Permission |
|---|---|---|
| `search_tasks` | Search and filter tasks in a project | Any authenticated user |
| `get_task` | Get detailed information about a specific task | Any authenticated user |
| `create_task` | Create a new task in a project | Any authenticated user |
| `update_task` | Update an existing task | Any authenticated user |
| `move_task` | Move a task to a different phase and/or position on the board | Any authenticated user |
| `delete_task` | Delete a task (destructive action - will ask for confirmation) | Any authenticated user |
| `bulk_update_tasks` | Perform a bulk operation on multiple tasks at once | Any authenticated user |
| `log_time` | Log time spent on a task | Any authenticated user |
| `duplicate_task` | Duplicate an existing task, optionally including its subtasks | Any authenticated user |
| `import_csv` | Import tasks from CSV data into a project | Any authenticated user |

### Comment Tools (2 tools) -- `comment-tools.ts`

| Tool | Description | Permission |
|---|---|---|
| `list_comments` | List all comments on a task | Any authenticated user |
| `add_comment` | Add a comment to a task | Any authenticated user |

### Member Tools (2 tools) -- `member-tools.ts`

| Tool | Description | Permission |
|---|---|---|
| `list_members` | List members of a project or the entire organization | Any authenticated user |
| `get_my_tasks` | Get tasks assigned to the current authenticated user, optionally filtered by project | Any authenticated user |

### Import Tools (2 tools) -- `import-tools.ts`

| Tool | Description | Permission |
|---|---|---|
| `import_github_issues` | Import GitHub issues into a project as tasks | Any authenticated user |
| `suggest_branch_name` | Generate a git branch name suggestion based on a task. Fetches the task and returns a name like "feature/FRND-42-design-login-screen". | Any authenticated user |

### Template Tools (2 tools) -- `template-tools.ts`

| Tool | Description | Permission |
|---|---|---|
| `list_templates` | List available task templates for a project | Any authenticated user |
| `create_from_template` | Create a task from a template, optionally overriding specific fields | Any authenticated user |

### Report Tools (8 tools) -- `report-tools.ts`

| Tool | Description | Permission |
|---|---|---|
| `get_velocity_report` | Get velocity report showing story points completed across recent sprints | Any authenticated user |
| `get_burndown` | Get burndown chart data for a specific sprint | Any authenticated user |
| `get_cumulative_flow` | Get cumulative flow diagram data for a project over a date range | Any authenticated user |
| `get_overdue_tasks` | Get a report of all overdue tasks in a project | Any authenticated user |
| `get_workload` | Get workload distribution report showing task counts and story points per team member | Any authenticated user |
| `get_status_distribution` | Get status distribution report showing task counts per phase/status | Any authenticated user |
| `get_cycle_time_report` | Get cycle time metrics (created_at to completed_at) for completed tasks in a project. | Any authenticated user |
| `get_time_tracking_report` | Get aggregated time entries per user for a project, optionally bounded by a date range. | Any authenticated user |

### Me / Profile Tools (10 tools) -- `me-tools.ts`

| Tool | Description | Permission |
|---|---|---|
| `get_me` | Get the authenticated user profile (display name, email, avatar, timezone, notification preferences, active org, superuser flag). | Any authenticated user |
| `update_me` | Update the authenticated user's own profile fields. | Any authenticated user |
| `list_my_orgs` | List organizations the authenticated user is a member of, including role in each. | Any authenticated user |
| `switch_active_org` | Switch the active organization for the current session. Affects which projects/members/tickets are returned by downstream calls. | Any authenticated user |
| `change_my_password` | Change the authenticated user's password. Requires the current password. | Any authenticated user |
| `logout` | Invalidate the current session cookie. Note: API-key callers are not affected -- this only logs out cookie sessions. | Any authenticated user |
| `list_my_notifications` | Fetch the caller's notification feed (paginated, cursor-based). | Any authenticated user |
| `mark_notification_read` | Mark a single notification as read. | Any authenticated user |
| `mark_notifications_read` | Mark several notifications as read in one call. | Any authenticated user |
| `mark_all_notifications_read` | Mark every notification in the caller's feed as read. | Any authenticated user |

### Platform Tools (5 tools) -- `platform-tools.ts`

| Tool | Description | Permission |
|---|---|---|
| `get_platform_settings` | SuperUser only. Fetch platform-wide settings (public signup toggle, etc). | SuperUser only |
| `set_public_signup_disabled` | SuperUser only. Toggle the platform-wide public signup kill switch. When true, POST /auth/register and POST /helpdesk/auth/register return 403 SIGNUP_DISABLED and the login pages' 'Create one' link routes to the beta-gate page. | SuperUser only |
| `list_beta_signups` | SuperUser only. List notify-me submissions from the public beta-gate form, newest first. | SuperUser only |
| `get_public_config` | SuperUser only (MCP gate). Read the unauthenticated /public/config -- currently returns whether public signup is disabled. The underlying endpoint is public, but we gate MCP access to SuperUsers since this is part of the platform-admin surface. | SuperUser only (MCP gate) |
| `submit_beta_signup` | SuperUser only (MCP gate). Create a notify-me submission via the public /public/beta-signup endpoint. The HTTP endpoint is public-by-anyone, but we only allow SuperUsers to invoke it through MCP (typically for testing or manual entry on behalf of a prospect). | SuperUser only (MCP gate) |

### Helpdesk Tools (7 tools) -- `helpdesk-tools.ts`

| Tool | Description | Permission |
|---|---|---|
| `list_tickets` | List helpdesk tickets with optional filters | Any authenticated user |
| `get_ticket` | Get detailed information about a helpdesk ticket including messages | Any authenticated user |
| `reply_to_ticket` | Send a message on a helpdesk ticket (public reply or internal note) | Any authenticated user |
| `update_ticket_status` | Update the status of a helpdesk ticket | Any authenticated user |
| `helpdesk_get_public_settings` | Get public-facing helpdesk configuration (categories, welcome message) | Any authenticated user |
| `helpdesk_get_settings` | Get full helpdesk settings including internal configuration | Admin |
| `helpdesk_update_settings` | Update helpdesk settings (categories, welcome message, default project, etc.) | Admin |

### Utility Tools (2 tools) -- `utility-tools.ts`

| Tool | Description | Permission |
|---|---|---|
| `get_server_info` | Get information about this MCP server including version, available tools, authenticated user, and rate limit status | Any authenticated user |
| `confirm_action` | Confirm a destructive action using a confirmation token. First call without a token to stage the action and receive a token. Then call again with the token to execute. | Any authenticated user |

### Banter Tools (47 tools) -- `banter-tools.ts`

#### Channel Tools (10)

| Tool | Description | Permission |
|---|---|---|
| `banter_list_channels` | List all Banter channels the current user has access to | Any authenticated user |
| `banter_get_channel` | Get detailed information about a Banter channel | Any authenticated user |
| `banter_create_channel` | Create a new Banter channel | Any authenticated user |
| `banter_update_channel` | Update a Banter channel name, description, or topic | Any authenticated user |
| `banter_archive_channel` | Archive a Banter channel (reversible) | Any authenticated user |
| `banter_delete_channel` | Delete a Banter channel (destructive - requires confirmation) | Any authenticated user |
| `banter_join_channel` | Join a Banter channel | Any authenticated user |
| `banter_leave_channel` | Leave a Banter channel | Any authenticated user |
| `banter_add_channel_members` | Add one or more members to a Banter channel | Any authenticated user |
| `banter_remove_channel_member` | Remove a member from a Banter channel | Any authenticated user |

#### Message Tools (8)

| Tool | Description | Permission |
|---|---|---|
| `banter_list_messages` | List messages in a Banter channel with pagination | Any authenticated user |
| `banter_get_message` | Get a specific Banter message by ID | Any authenticated user |
| `banter_post_message` | Post a new message to a Banter channel | Any authenticated user |
| `banter_edit_message` | Edit an existing Banter message | Any authenticated user |
| `banter_delete_message` | Delete a Banter message (destructive - requires confirmation) | Any authenticated user |
| `banter_react` | Add or remove an emoji reaction on a Banter message | Any authenticated user |
| `banter_pin_message` | Pin a message in a Banter channel | Any authenticated user |
| `banter_unpin_message` | Unpin a message from a Banter channel | Any authenticated user |

#### Thread Tools (2)

| Tool | Description | Permission |
|---|---|---|
| `banter_list_thread_replies` | List replies in a Banter message thread | Any authenticated user |
| `banter_reply_to_thread` | Post a reply in a Banter message thread | Any authenticated user |

#### Search Tools (3)

| Tool | Description | Permission |
|---|---|---|
| `banter_search_messages` | Search messages across Banter channels | Any authenticated user |
| `banter_browse_channels` | Browse available Banter channels (including unjoined public channels) | Any authenticated user |
| `banter_search_transcripts` | Search call transcripts across Banter (placeholder - returns available transcripts) | Any authenticated user |

#### DM Tools (2)

| Tool | Description | Permission |
|---|---|---|
| `banter_send_dm` | Send a direct message to another user (creates or reuses existing DM channel) | Any authenticated user |
| `banter_send_group_dm` | Send a group direct message (creates or reuses existing group DM) | Any authenticated user |

#### User Group Tools (5)

| Tool | Description | Permission |
|---|---|---|
| `banter_list_user_groups` | List all user groups in the organization | Any authenticated user |
| `banter_create_user_group` | Create a new user group (e.g. @backend-team) | Any authenticated user |
| `banter_update_user_group` | Update a user group name, handle, or description | Any authenticated user |
| `banter_add_group_members` | Add members to a user group | Any authenticated user |
| `banter_remove_group_member` | Remove a member from a user group | Any authenticated user |

#### Call Tools (10)

| Tool | Description | Permission |
|---|---|---|
| `banter_start_call` | Start a new voice/video call in a Banter channel | Any authenticated user |
| `banter_join_call` | Join an active call | Any authenticated user |
| `banter_leave_call` | Leave an active call | Any authenticated user |
| `banter_end_call` | End an active call (destructive - requires confirmation) | Any authenticated user |
| `banter_get_call` | Get details about a specific call | Any authenticated user |
| `banter_list_calls` | List calls in a Banter channel (active and recent) | Any authenticated user |
| `banter_get_transcript` | Get the transcript for a call | Any authenticated user |
| `banter_invite_agent_to_call` | Invite an AI agent to join an active call as a participant | Any authenticated user |
| `banter_post_call_text` | Post a text message in a call channel with a call reference (for text-mode AI participation) | Any authenticated user |
| `banter_get_active_huddle` | Check if a channel has an active huddle and get its details | Any authenticated user |

#### Integration Tools (4)

| Tool | Description | Permission |
|---|---|---|
| `banter_share_task` | Share a BigBlueBam task as a rich embed in a Banter channel | Any authenticated user |
| `banter_share_sprint` | Share a BigBlueBam sprint summary as a rich embed in a Banter channel | Any authenticated user |
| `banter_share_ticket` | Share a Helpdesk ticket as a rich embed in a Banter channel | Any authenticated user |
| `banter_get_unread` | Get the current user's unread message summary across all Banter channels | Any authenticated user |

#### User Preference & Presence Tools (3)

| Tool | Description | Permission |
|---|---|---|
| `banter_get_preferences` | Get the current user's Banter notification and theme preferences | Any authenticated user |
| `banter_update_preferences` | Update the current user's Banter notification and theme preferences | Any authenticated user |
| `banter_set_presence` | Set an ephemeral presence status (online, idle, dnd, offline) with optional status text and emoji | Any authenticated user |

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
