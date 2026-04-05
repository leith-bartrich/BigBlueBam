<p align="center">
  <img src="docs/images/logo.svg" alt="BigBlueBam Logo" width="100" height="100" />
</p>

<h1 align="center">BigBlueBam</h1>

<p align="center">
  <strong>Project management built for human-AI teams.</strong><br/>
  Engineers set the strategy. AI agents handle the grunt work. Everyone sees it on the board.
</p>

<p align="center">
  <a href="#the-vision">Vision</a> &bull;
  <a href="#product-tour">Tour</a> &bull;
  <a href="#for-teams">For Teams</a> &bull;
  <a href="#for-ai-agents">For AI Agents</a> &bull;
  <a href="#banter">Banter</a> &bull;
  <a href="#helpdesk">Helpdesk</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#documentation">Docs</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tests-530%2B%20passing-brightgreen" alt="Tests" />
  <img src="https://img.shields.io/badge/MCP%20tools-86-blue" alt="MCP Tools" />
  <img src="https://img.shields.io/badge/Docker%20services-12-blueviolet" alt="Docker Services" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

---

## The Vision

Most project management tools are built for humans talking to humans. BigBlueBam is built for **human-AI collaborative development** — a world where engineers and AI agents work side by side on the same board, in the same sprints, toward the same goals.

**Humans** own the strategy: setting priorities, defining epics, reviewing deliverables, talking to customers.

**AI agents** own the routine: triaging helpdesk tickets, creating tasks from bug reports, posting status updates, generating sprint reports, and keeping the board organized.

The **Kanban board** is the shared workspace. When an AI agent creates a task, moves a card, or replies to a customer, it shows up on the board in real time — right alongside everything your team is doing. No separate dashboards. No hidden automation. Full transparency.

This is made possible by **86 MCP tools** that give AI assistants (Claude, Claude Code, custom agents) full read-write access to projects, tasks, sprints, comments, reports, helpdesk tickets, and team messaging.

---

## Product Tour

<p align="center">
  <img src="images/03-board.png" alt="Kanban Board" width="100%" />
</p>
<p align="center"><em>The Kanban board — the central hub where human and AI work converges.</em></p>

<br/>

<table>
  <tr>
    <td width="50%"><img src="images/07-timeline.png" alt="Timeline View" width="100%" /></td>
    <td width="50%"><img src="images/08-calendar.png" alt="Calendar View" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>Timeline / Gantt view</em></td>
    <td align="center"><em>Calendar view</em></td>
  </tr>
  <tr>
    <td width="50%"><img src="images/06-list-view.png" alt="List View" width="100%" /></td>
    <td width="50%"><img src="images/09-project-dashboard.png" alt="Project Analytics" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>List / table view</em></td>
    <td align="center"><em>Project analytics dashboard</em></td>
  </tr>
  <tr>
    <td width="50%"><img src="images/16-helpdesk-tickets.png" alt="Helpdesk Tickets" width="100%" /></td>
    <td width="50%"><img src="images/14-command-palette.png" alt="Command Palette" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>Helpdesk ticket list</em></td>
    <td align="center"><em>Command palette (Ctrl+K)</em></td>
  </tr>
</table>

---

## For Teams

### Kanban Board

Drag-and-drop cards across 5 configurable phases with WIP limits. Each card shows priority, assignee, story points, due date, and comment count at a glance. Motion spring physics make the interactions feel natural.

<p align="center">
  <img src="images/03-board.png" alt="Kanban Board — Dark Mode" width="100%" />
</p>
<p align="center"><em>Dark mode — the default for late-night deploys.</em></p>

<p align="center">
  <img src="images/13-board-light.png" alt="Kanban Board — Light Mode" width="100%" />
</p>
<p align="center"><em>Light mode — because some people like the sun.</em></p>

### Swimlanes

Group tasks by assignee, priority, or epic. Collapsible rows show task count and total story points per group, making it easy to spot bottlenecks and unbalanced workloads.

<p align="center">
  <img src="images/05-swimlanes.png" alt="Swimlanes by Assignee" width="100%" />
</p>

### Five Views, One Board

Every project supports five views — switch between them without losing your filters or context:

| View | What it shows |
|------|--------------|
| **Board** | Kanban columns with drag-and-drop cards |
| **List** | Sortable, filterable table with inline editing |
| **Timeline** | Gantt-style horizontal bars from start to due date |
| **Calendar** | Monthly calendar with tasks on their due dates |
| **Workload** | Team member capacity and allocation |

<table>
  <tr>
    <td width="50%"><img src="images/06-list-view.png" alt="List View" width="100%" /></td>
    <td width="50%"><img src="images/07-timeline.png" alt="Timeline View" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>List view with sortable columns</em></td>
    <td align="center"><em>Timeline / Gantt view with today marker</em></td>
  </tr>
</table>

<p align="center">
  <img src="images/08-calendar.png" alt="Calendar View" width="100%" />
</p>
<p align="center"><em>Calendar view — monthly navigation with task due dates</em></p>

### Task Detail

Click any card to open the detail drawer. Full rich-text description with image support, assignee, priority, phase, sprint, story points, start and due dates, subtasks, file attachments, comments with emoji reactions, and a complete activity feed.

<p align="center">
  <img src="images/04-task-detail.png" alt="Task Detail Drawer" width="100%" />
</p>

### Sprint Management

Create sprints, assign tasks, track velocity. When a sprint ends, the carry-forward ceremony moves incomplete work to the next sprint automatically. Sprint reports show burndown, velocity trends, and completion rates.

### Project Dashboard

Charts and widgets for sprint progress, priority breakdown, overdue tasks, task distribution by phase, and team workload — all in one place.

<p align="center">
  <img src="images/09-project-dashboard.png" alt="Project Analytics Dashboard" width="100%" />
</p>

### My Work

A cross-project view of everything assigned to you, grouped by project. One place to see your full plate.

<p align="center">
  <img src="images/10-my-work.png" alt="My Work View" width="100%" />
</p>

### Command Palette

Press **Ctrl+K** to open the command palette. Search tasks, switch projects, navigate views, and trigger actions without touching the mouse.

<p align="center">
  <img src="images/14-command-palette.png" alt="Command Palette" width="100%" />
</p>

### Organization Management

BigBlueBam ships a dedicated **People** surface (not buried under Settings) that covers the full identity lifecycle — invite, edit, assign, disable — with strict role-based gating.

<p align="center">
  <img src="images/people-list.png" alt="People list — searchable, filterable, bulk-selectable" width="100%" />
</p>

Filter by role or status, search by name or email, and act on individual members or in bulk.

#### Per-user detail, four tabs

<table>
  <tr>
    <td width="50%"><img src="images/people-detail-overview.png" alt="Overview tab" width="100%" /></td>
    <td width="50%"><img src="images/people-detail-projects.png" alt="Projects tab" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>Overview — identity, membership, disable toggle</em></td>
    <td align="center"><em>Projects — per-project roles, bulk assign</em></td>
  </tr>
  <tr>
    <td width="50%"><img src="images/people-detail-access.png" alt="Access tab" width="100%" /></td>
    <td width="50%"><img src="images/people-detail-activity.png" alt="Activity tab" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>Access — API keys, password reset, force change</em></td>
    <td align="center"><em>Activity — per-user audit trail</em></td>
  </tr>
</table>

Admins can reset passwords (manual or auto-generated), mint API keys on behalf of users with scoped permissions, force a password change on next login, or sign the user out of every device.

<table>
  <tr>
    <td width="50%"><img src="images/people-reset-password-dialog.png" alt="Reset password dialog" width="100%" /></td>
    <td width="50%"><img src="images/people-create-api-key-dialog.png" alt="Create API key dialog" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>Reset password — auto-generate or set manually</em></td>
    <td align="center"><em>Create API key on behalf of a user (one-time token reveal)</em></td>
  </tr>
</table>

#### Bulk operations

Select multiple members to disable, enable, change role, remove from org, or export as CSV — all with rank-gating that mirrors the server:

<p align="center">
  <img src="images/people-bulk-toolbar.png" alt="Bulk actions toolbar" width="100%" />
</p>

#### Multi-org membership

Users can belong to multiple organizations. The header shows the current org + role, and the org switcher lets multi-org users hop between them in one click — the session rotates and every query is invalidated, so the rest of the app instantly reflects the new org's data.

<p align="center">
  <img src="images/org-switcher.png" alt="Org switcher dropdown" width="75%" />
</p>

A persistent banner warns when an org has no active owner, so operators can promote a replacement before the situation becomes invisible:

<p align="center">
  <img src="images/no-owner-banner.png" alt="No active owner banner" width="100%" />
</p>

#### SuperUser console

A separate SuperUser namespace at `/b3/superuser` gives platform operators cross-org visibility without impersonation. See every org on the server, context-switch into any of them, and manage users globally.

<p align="center">
  <img src="images/superuser-overview.png" alt="SuperUser console overview" width="100%" />
</p>

**Cross-org user management** — one view of every user regardless of org:

<p align="center">
  <img src="images/superuser-people-list.png" alt="SuperUser cross-org people list" width="100%" />
</p>

<table>
  <tr>
    <td width="50%"><img src="images/superuser-people-memberships.png" alt="All memberships" width="100%" /></td>
    <td width="50%"><img src="images/superuser-people-sessions.png" alt="Active sessions" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>Every org the user belongs to — add, remove, change role, set default</em></td>
    <td align="center"><em>Every active session with IP, device, and revoke controls</em></td>
  </tr>
</table>

<p align="center">
  <img src="images/superuser-people-activity.png" alt="SuperUser audit log for a user" width="100%" />
</p>
<p align="center"><em>Audit log — every SuperUser action against this user with expandable details</em></p>

When a SuperUser is context-switched into a non-native org, a red banner and chip in the header make the privileged state impossible to miss:

<p align="center">
  <img src="images/superuser-context-banner.png" alt="SuperUser context banner" width="100%" />
</p>

#### Forced password change

Admins can flag a user to require a password change on their next login. On sign-in, the user is bounced to a dedicated form that blocks every other page until a new password is set:

<p align="center">
  <img src="images/password-change.png" alt="Forced password change page" width="100%" />
</p>

#### Theme-aware UI

Every screen adapts to light and dark mode. Most of the shots in this README are dark; here's the same People list in light mode:

<p align="center">
  <img src="images/people-list-light.png" alt="People list — light mode" width="100%" />
</p>

#### Integrations

Configure calendar feeds, API keys, and webhooks under Settings:

<p align="center">
  <img src="images/12-integrations.png" alt="Integrations Settings" width="100%" />
</p>

---

## For AI Agents

BigBlueBam exposes **86 MCP (Model Context Protocol) tools** that give AI assistants full access to your project management workflow, team messaging, and customer support. Connect Claude, Claude Code, or any MCP-compatible agent and let it work alongside your team.

### What AI Agents Can Do

- **Create and manage tasks** — create tasks, set priority and assignee, move cards across phases, add subtasks
- **Run sprints** — create sprints, assign tasks, start/complete sprints, generate sprint reports
- **Triage helpdesk tickets** — when a customer submits a ticket, a task is auto-created; AI agents can then triage by adjusting priority, setting timelines, assigning to the right engineer, rejecting out-of-scope requests, and posting responses to customers
- **Generate reports** — velocity reports, burndown charts, cumulative flow, workload distribution, overdue task alerts
- **Collaborate** — post comments, log time, bulk update tasks, suggest branch names
- **Message the team via Banter** — post messages, read channels, respond in threads, share task updates, manage channels, react to messages, search conversations, and participate in voice calls as spoken participants

### Example: AI-Powered Helpdesk Triage

> A customer submits a bug report through the helpdesk portal. BigBlueBam automatically creates a `FRND-` prefixed task on the board. An AI agent picks up the new task, analyzes the description, sets priority to High, assigns it to the right engineer based on the related epic, adjusts the timeline, and posts a response to the customer: *"Thanks for reporting this — we've assigned task FRND-247 to the team and it's been prioritized. We'll update you when there's a fix."*
>
> The engineer sees the triaged card on their board. The customer sees the response in their portal. The task was created automatically; the AI handled the triage.

### Example: AI Gathering Details from Vague Reports

> A customer submits a ticket: *"The app isn't working."* BigBlueBam auto-creates a task, and an AI agent picks it up. Recognizing the report lacks actionable detail, the agent responds to the customer through the helpdesk portal:
>
> *"Sorry to hear that! To help us investigate, could you provide a few details?*
> - *What were you trying to do when the issue occurred?*
> - *What device and browser are you using? (e.g., iPhone 14 / Safari, Windows / Chrome)*
> - *Does the issue happen every time or intermittently?*
> - *If possible, a screenshot of any error message would be very helpful."*
>
> The agent sets the task to `waiting_on_customer` and adds an internal note for the engineering team: *"Vague report — asked customer for repro steps, device info, and screenshots. Will re-triage once details come in."* When the customer replies with specifics, the agent updates the task description, sets the appropriate priority, and assigns it to the right engineer — all before a human touches it.

### MCP Tools Reference

| Category | Tools | What they do |
|----------|-------|-------------|
| **Projects** | `list_projects`, `get_project`, `create_project` | Browse and create projects |
| **Board** | `get_board`, `list_phases`, `create_phase`, `reorder_phases` | Read board state, configure columns |
| **Tasks** | `search_tasks`, `get_task`, `create_task`, `update_task`, `move_task`, `delete_task`, `duplicate_task`, `bulk_update_tasks` | Full CRUD on tasks with search and bulk ops |
| **Sprints** | `list_sprints`, `create_sprint`, `start_sprint`, `complete_sprint`, `get_sprint_report` | Sprint lifecycle management |
| **Comments** | `list_comments`, `add_comment` | Read and post comments on tasks |
| **Members** | `list_members`, `get_my_tasks` | Team member info and personal task lists |
| **Reports** | `get_velocity_report`, `get_burndown`, `get_cumulative_flow`, `get_overdue_tasks`, `get_workload`, `get_status_distribution` | Analytics and reporting |
| **Templates** | `list_templates`, `create_from_template` | Task templates for repeatable workflows |
| **Import** | `import_csv`, `import_github_issues`, `suggest_branch_name` | Data import and git integration |
| **Time** | `log_time` | Time tracking entries |
| **Helpdesk** | `list_tickets`, `get_ticket`, `reply_to_ticket`, `update_ticket_status` | Ticket management and customer communication |
| **Banter** | 44 tools including `banter_post_message`, `banter_list_channels`, `banter_create_channel`, `banter_search_messages`, `banter_start_call`, `banter_invite_agent_to_call` | Team messaging, channels, threads, reactions, calls, voice agent |
| **Utility** | `get_server_info`, `confirm_action` | Server metadata and confirmation flows |

### MCP Setup

Add this to your Claude Desktop or Claude Code configuration:

```json
{
  "mcpServers": {
    "bigbluebam": {
      "url": "http://localhost/mcp/",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Generate an API key from **Settings > Integrations** in the BigBlueBam UI.

---

## Banter

> **Alpha Software** — Banter is under active development and in early release. Bug reports and pull requests are welcome.

Banter is a real-time team messaging platform built natively into the BigBlueBam suite. Channels, direct messages, threaded conversations, voice and video calls, and AI agent participation — all deeply integrated with your project board and helpdesk.

<p align="center">
  <img src="images/19-banter-channels.png" alt="Banter Channel View" width="100%" />
</p>
<p align="center"><em>Banter — channel view with sidebar, message compose, and team member list</em></p>

### Why Not Just Use Slack?

Because Banter shares authentication, database, and deep cross-linking with BigBlueBam. When someone mentions `BBB-247` in a channel, it links directly to the task. When an AI agent triages a helpdesk ticket, it can post the update to `#support-triage`. Sprint reports can be shared to channels with one click. No webhooks, no bridges, no sync lag.

### Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Channels** | Stable | Public and private channels with topics, descriptions, member management |
| **Direct Messages** | Stable | 1:1 and group DMs with presence indicators |
| **Threads** | Stable | Nested conversations on any message |
| **Rich Text** | Stable | Markdown with bold, italic, code, links, images |
| **Reactions** | Stable | Emoji reactions with toggle semantics |
| **Mentions** | Stable | @user mentions with autocomplete and notifications |
| **Search** | Stable | Full-text search across channels with filters (author, date, attachments) |
| **File Sharing** | Stable | Upload and share files with inline image previews |
| **Pins & Bookmarks** | Stable | Pin messages to channels, bookmark for personal reference |
| **Presence** | Stable | Online, idle, DND status with automatic idle detection |
| **Notifications** | Stable | Mention, DM, thread reply, and channel invite notifications |
| **Voice Calls** | Alpha | Voice and video calls via LiveKit SFU |
| **AI Voice Agent** | Placeholder | AI participation in calls (STT/TTS pipeline, requires provider config) |
| **BBB Integration** | Stable | Task references, Share to Banter, activity feed bot |
| **44 MCP Tools** | Stable | Full AI agent access to all messaging features |

### Channel View

<p align="center">
  <img src="images/19-banter-channels.png" alt="Banter Channel View" width="100%" />
</p>

The sidebar shows channels, direct messages, and team members. The message compose area supports markdown formatting, file attachments, emoji picker, and @mention autocomplete. Hover over any message for quick reactions, thread replies, pins, and bookmarks.

<table>
  <tr>
    <td width="50%"><img src="images/20-banter-search.png" alt="Banter Search" width="100%" /></td>
    <td width="50%"><img src="images/22-banter-browse.png" alt="Banter Browse Channels" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>Search with channel, author, and date filters</em></td>
    <td align="center"><em>Browse and join public channels</em></td>
  </tr>
</table>

### Administration

<p align="center">
  <img src="images/21-banter-admin.png" alt="Banter Admin Settings" width="100%" />
</p>
<p align="center"><em>Admin panel — voice/video configuration, channel settings, AI voice agent providers</em></p>

### Banter MCP Tools

AI agents can interact with Banter through **44 dedicated MCP tools**:

| Category | Tools | What they do |
|----------|-------|-------------|
| **Channels** | `banter_list_channels`, `banter_create_channel`, `banter_update_channel`, `banter_archive_channel`, `banter_join_channel`, `banter_leave_channel` | Channel lifecycle management |
| **Messages** | `banter_post_message`, `banter_edit_message`, `banter_delete_message`, `banter_get_message` | Send and manage messages |
| **Threads** | `banter_reply_in_thread`, `banter_get_thread` | Threaded conversations |
| **Reactions** | `banter_add_reaction`, `banter_remove_reaction` | Emoji reactions |
| **Search** | `banter_search_messages`, `banter_search_channels`, `banter_search_transcripts` | Full-text search |
| **DMs** | `banter_start_dm`, `banter_start_group_dm`, `banter_list_dms` | Direct messaging |
| **Calls** | `banter_start_call`, `banter_join_call`, `banter_end_call`, `banter_invite_agent_to_call`, `banter_get_transcript` | Voice/video call management |
| **Members** | `banter_list_members`, `banter_add_members`, `banter_remove_member`, `banter_update_member_role` | Channel membership |
| **Admin** | `banter_get_settings`, `banter_update_settings`, `banter_list_user_groups` | Organization-level configuration |
| **Pins & Bookmarks** | `banter_pin_message`, `banter_unpin_message`, `banter_bookmark_message` | Message organization |

---

## Helpdesk

BigBlueBam includes a full client-facing helpdesk portal. Customers submit tickets, your team (or your AI agents) responds, and every ticket is linked to a task on the board.

### Client Portal

Customers log into their own portal at `/helpdesk/`, submit tickets with categories and priority, and track responses — all with clean, simple branding separate from the internal tool.

<table>
  <tr>
    <td width="50%"><img src="images/15-helpdesk-login.png" alt="Helpdesk Login" width="100%" /></td>
    <td width="50%"><img src="images/16-helpdesk-tickets.png" alt="Helpdesk Ticket List" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>Helpdesk portal login</em></td>
    <td align="center"><em>Client ticket list with status badges</em></td>
  </tr>
</table>

### Ticket-to-Task Pipeline

When a client submits a ticket, BigBlueBam automatically creates a linked task on your board. Moving the task through phases updates the ticket status. Clients see progress without your team lifting a finger.

<p align="center">
  <img src="images/17-helpdesk-conversation.png" alt="Helpdesk Ticket Detail" width="100%" />
</p>
<p align="center"><em>Ticket detail with description and metadata</em></p>

### Agent Conversations

Team members (or AI agents via MCP) reply directly to tickets. Agent replies are visible to clients. Internal comments stay private. Full threading keeps the conversation organized.

<p align="center">
  <img src="images/18-helpdesk-detail-conversation.png" alt="Helpdesk Conversation" width="100%" />
</p>
<p align="center"><em>Client and agent conversation on a helpdesk ticket</em></p>

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Node.js 22+](https://nodejs.org/) and [pnpm 9+](https://pnpm.io/) (for development only)

### Run with Docker

```bash
# Clone the repo
git clone https://github.com/eoffermann/BigBlueBam.git
cd BigBlueBam

# Set up environment
cp .env.example .env
# Edit .env with your secrets (passwords, session secret)

# Start all services
docker compose up -d

# Create your admin account
docker compose exec api node dist/cli.js create-admin \
  --email admin@example.com \
  --password YourPassword123 \
  --name "Admin User" \
  --org "My Organization"
```

Open **http://localhost/b3/** to access BigBlueBam, **http://localhost/banter/** for Banter, or **http://localhost/helpdesk/** for the helpdesk portal.

<p align="center">
  <img src="images/01-login.png" alt="Login Page" width="60%" />
</p>
<p align="center"><em>The login page — clean and branded.</em></p>

After login, you land on the project dashboard:

<p align="center">
  <img src="images/02-dashboard.png" alt="Project Dashboard" width="100%" />
</p>

### Services

All services are accessed through a single nginx container on port 80:

| URL Path | Backend | Description |
|----------|---------|-------------|
| `/` | redirect | Redirects to `/helpdesk/` |
| `/b3/` | nginx | BigBlueBam React SPA |
| `/b3/api/` | Fastify `:4000` | BigBlueBam REST API |
| `/b3/ws` | Fastify `:4000` | WebSocket (real-time updates) |
| `/banter/` | nginx | Banter team messaging SPA |
| `/banter/api/` | Fastify `:4002` | Banter REST API |
| `/banter/ws` | Fastify `:4002` | Banter WebSocket (real-time messaging) |
| `/helpdesk/` | nginx | Helpdesk portal SPA |
| `/helpdesk/api/` | Fastify `:4001` | Helpdesk API (auth, tickets, messages) |
| `/files/` | MinIO `:9000` | Uploaded files (shared) |
| `/mcp/` | MCP Server `:3001` | Model Context Protocol (86 tools) |

Infrastructure services (internal, not exposed via nginx):

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | `:5432` | Primary database |
| Redis | `:6379` | Cache, PubSub, queues |
| MinIO | `:9000` | S3-compatible file storage |
| Worker | -- | BullMQ background job processor |
| LiveKit | `:7880` | Voice/video SFU (WebRTC media server) |
| Voice Agent | `:4003` | AI voice call participation (Python/FastAPI) |

### Development Mode

```bash
pnpm install
pnpm --filter @bigbluebam/shared build
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Run Tests

```bash
pnpm test  # 530+ tests across all packages
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Clients (Browser / AI)                         │
└────────────────────────┬──────────────────────┬──────────────────────┘
                         │ HTTP :80              │ WebRTC
┌────────────────────────▼──────────────────────┐│
│               nginx (single container, :80)    ││
│  /b3/          → BigBlueBam SPA (static)       ││
│  /b3/api/      → Fastify API :4000             ││
│  /b3/ws        → WebSocket :4000               ││
│  /banter/      → Banter SPA (static)           ││
│  /banter/api/  → Banter API :4002              ││
│  /banter/ws    → Banter WebSocket :4002        ││
│  /helpdesk/    → Helpdesk SPA (static)         ││
│  /helpdesk/api/→ Helpdesk API :4001            ││
│  /files/       → MinIO :9000                   ││
│  /mcp/         → MCP Server :3001              ││
└──────┬──────────┬──────────┬───────────────────┘│
       │          │          │                     │
┌──────▼────┐ ┌──▼───────┐ ┌▼──────────┐ ┌───────▼──────┐ ┌──────────┐
│ BBB API   │ │ Banter   │ │ MCP Server│ │ LiveKit SFU  │ │ Worker   │
│ :4000     │ │ API :4002│ │ :3001     │ │ :7880 (voice)│ │ BullMQ   │
│ +WebSocket│ │ +WS      │ │ 86 tools  │ │ +voice-agent │ │ jobs     │
└─────┬─────┘ └────┬─────┘ └─────┬─────┘ └──────────────┘ └────┬─────┘
      │             │             │                              │
┌─────▼─────────────▼─────────────▼──────────────────────────────▼─────┐
│  PostgreSQL 16       │  Redis 7             │  MinIO (S3)            │
│  40+ tables          │  PubSub + cache      │  File storage          │
└──────────────────────┴──────────────────────┴────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TailwindCSS v4, Motion, TanStack Query, Zustand, dnd-kit, Radix UI |
| **API** | Node.js 22, Fastify v5, Drizzle ORM, Zod |
| **Realtime** | WebSocket + Redis PubSub |
| **MCP** | @modelcontextprotocol/sdk (Streamable HTTP + SSE) |
| **Voice/Video** | LiveKit SFU, WebRTC, Python voice agent (STT/TTS) |
| **Database** | PostgreSQL 16, Redis 7, MinIO |
| **Worker** | BullMQ, Nodemailer |
| **Build** | Turborepo, pnpm workspaces, tsup, Vite |
| **Testing** | Vitest (530+ tests) |
| **Deploy** | Docker Compose, multi-stage Dockerfiles |

### Monorepo Structure

```
apps/
  api/              → Fastify REST API + WebSocket (23 route modules)
  frontend/         → React SPA (33 components, 8 pages)
  mcp-server/       → MCP protocol server (86 tools)
  worker/           → BullMQ background jobs (incl. Banter notifications & retention)
  helpdesk-api/     → Helpdesk Fastify API (auth, tickets, messages)
  helpdesk/         → Helpdesk React SPA (client-facing portal)
  banter-api/       → Banter Fastify API + WebSocket (15 route modules, 18 DB tables)
  banter/           → Banter React SPA (14 components, 7 pages)
  voice-agent/      → AI voice agent (Python/FastAPI, LiveKit Agents SDK)
packages/
  shared/           → Zod schemas, TypeScript types, constants
infra/
  postgres/         → Database schema (init.sql — 40+ tables)
  nginx/            → Reverse proxy config (single nginx serves all 3 SPAs)
  livekit/          → LiveKit SFU configuration
docs/               → 8 documentation pages with Mermaid diagrams
scripts/            → Utility and seed scripts
```

### Key Numbers

| Metric | Count |
|--------|-------|
| Docker services | 12 |
| MCP tools | 86 (42 BBB + 44 Banter) |
| Test cases | 530+ |
| API route modules | 38 (23 BBB + 15 Banter) |
| Database tables | 40+ (25 BBB + 18 Banter) |
| Frontend components | 47+ (33 BBB + 14 Banter) |
| Documentation pages | 8 |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Setup, first run, troubleshooting |
| [Architecture](docs/architecture.md) | System design, data flow, components |
| [Database](docs/database.md) | ER diagrams, table descriptions, indexing |
| [API Reference](docs/api-reference.md) | All REST endpoints with examples |
| [MCP Server](docs/mcp-server.md) | Tools, resources, prompts, configuration |
| [Operations](docs/operations.md) | Updates, backups, scaling, troubleshooting |
| [Deployment](docs/deployment.md) | Docker, Kubernetes, scaling, backup |
| [Development](docs/development.md) | Contributing, testing, code style |
| [Helpdesk Design](BigBlueBam_Helpdesk_Design_Document.md) | Helpdesk ticketing system design |
| [Banter Design](Banter_Design_Document.md) | Team messaging & voice/video design |

---

## License

MIT -- see [LICENSE](LICENSE).

---

<p align="center">
  Built with <a href="https://claude.ai/code">Claude Code</a>
</p>
