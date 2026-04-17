<p align="center">
  <img src="docs/images/logo.svg" alt="BigBlueBam Logo" width="100" height="100" />
</p>

<h1 align="center">BigBlueBam</h1>

<p align="center">
  <strong>The work suite built for human-AI teams.</strong><br/>
  Your team sets the strategy. AI agents handle the routine. Everyone works in the same place.
</p>

<p align="center">
  <a href="#the-vision">Vision</a> &bull;
  <a href="#product-tour">Tour</a> &bull;
  <a href="#for-teams">For Teams</a> &bull;
  <a href="#for-ai-agents">For AI Agents</a> &bull;
  <a href="#banter">Banter</a> &bull;
  <a href="#helpdesk">Helpdesk</a> &bull;
  <a href="#beacon">Beacon</a> &bull;
  <a href="#brief">Brief</a> &bull;
  <a href="#bolt">Bolt</a> &bull;
  <a href="#bearing">Bearing</a> &bull;
  <a href="#board">Board</a> &bull;
  <a href="#bond">Bond</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#documentation">Docs</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tests-900%2B%20passing-brightgreen" alt="Tests" />
  <img src="https://img.shields.io/badge/MCP%20tools-215-blue" alt="MCP Tools" />
  <img src="https://img.shields.io/badge/Docker%20services-19-blueviolet" alt="Docker Services" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

---

## The Vision

Most work platforms are built for humans talking to humans. BigBlueBam is built for **human-AI collaboration**, a world where your team and AI agents plan projects, message each other, close deals, write docs, track goals, automate workflows, and support customers in the same suite, at the same time.

**Humans** own the strategy: setting priorities, defining epics, closing deals, reviewing deliverables, talking to customers.

**AI agents** own the routine: triaging helpdesk tickets, writing knowledge base articles, drafting documents, updating CRM pipelines, generating sprint reports, firing workflow automations, and keeping the board organized.

The **suite** is the shared workspace. When an AI agent creates a task, replies to a customer, updates a deal, or posts to a Banter channel, it shows up in real time, right alongside everything your team is doing. No separate dashboards. No hidden automation. Full transparency.

This is made possible by **215 MCP tools** that give AI assistants (Claude, Claude Code, custom agents) full read-write access to project boards, sprints, team messaging, helpdesk tickets, knowledge base, collaborative docs, workflow automations, goals and OKRs, whiteboards, CRM pipelines, email campaigns, analytics dashboards, and more.

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

BigBlueBam exposes **215 MCP (Model Context Protocol) tools** that give AI assistants full access to your project management workflow, team messaging, customer support, knowledge base, collaborative documents, workflow automations, goals & OKRs, visual collaboration whiteboards, and CRM pipeline management. Connect Claude, Claude Code, or any MCP-compatible agent and let it work alongside your team.

### What AI Agents Can Do

- **Create and manage tasks** — create tasks, set priority and assignee, move cards across phases, add subtasks
- **Run sprints** — create sprints, assign tasks, start/complete sprints, generate sprint reports
- **Triage helpdesk tickets** — when a customer submits a ticket, a task is auto-created; AI agents can then triage by adjusting priority, setting timelines, assigning to the right engineer, rejecting out-of-scope requests, and posting responses to customers
- **Generate reports** — velocity reports, burndown charts, cumulative flow, workload distribution, overdue task alerts
- **Collaborate** — post comments, log time, bulk update tasks, suggest branch names
- **Message the team via Banter** — post messages, read channels, respond in threads, share task updates, manage channels, react to messages, search conversations, and participate in voice calls as spoken participants
- **Manage the knowledge base via Beacon** — create and publish Beacons, search with semantic + graph retrieval, verify content freshness, link related knowledge, manage governance policies, and save reusable queries
- **Author collaborative documents via Brief** — create, edit, and search documents, manage version history, leave inline comments, apply templates, and graduate finished documents into Beacons
- **Automate workflows with Bolt** — create trigger-condition-action rules, manage executions, browse templates, and orchestrate cross-product automations that compile to MCP tool calls
- **Track goals & OKRs with Bearing** — create time-boxed periods, define goals with key results, link KRs to Bam tasks for automatic progress, post status updates, and generate at-risk reports
- **Collaborate visually on Board** — create and manage whiteboard rooms, add and arrange shapes, read canvas content for AI analysis, manage participants, embed cross-product content, and run sticky-to-task pipelines
- **Manage CRM pipeline with Bond** — create and update contacts, companies, and deals, advance deals through pipeline stages, log activities, search the contact database, and generate pipeline reports

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

**215 tools** across 20 categories:

| Category | Count | What they cover |
|----------|------:|-----------------|
| **Task Management** | 10 | CRUD, move, bulk update, duplicate, time logging |
| **Board & Phases** | 4 | Board view, phase CRUD, reorder |
| **Sprints** | 5 | CRUD, start, complete, report |
| **Projects** | 5 | List, get, create, test Slack webhook, disconnect GitHub |
| **Reports** | 8 | Velocity, burndown, CFD, cycle time, time tracking, overdue, workload, status distribution |
| **Comments** | 2 | List, add |
| **Members** | 2 | List, get my tasks |
| **Templates** | 2 | List, create from template |
| **Import** | 2 | CSV import, GitHub Issues import |
| **User Profile & Notifications** | 10 | Profile CRUD, org switching, password, logout, notification feed management |
| **Platform Admin** | 5 | Platform settings toggle, beta signups, public config (SuperUser-gated) |
| **Banter Messaging** | 47 | Channels, DMs, messages, threads, reactions, calls, search, admin, presence, preferences |
| **Beacon Knowledge Base** | 29 | CRUD, search, verification, graph, policies, saved queries |
| **Brief Documents** | 18 | CRUD, collaboration, versions, search, graduation, templates |
| **Bolt Automation** | 12 | Rule CRUD, execution management, templates, triggers, conditions, actions |
| **Bearing Goals** | 12 | Periods, goals, key results, progress, links, reports, at-risk detection |
| **Board Whiteboard** | 14 | Room CRUD, shapes, assets, canvas reading, participants, embeds, sticky-to-task |
| **Bond CRM** | 19 | Contacts, companies, deals, pipeline stages, activities, notes, search, reports |
| **Helpdesk** | 7 | Ticket operations, public/admin settings |
| **Utility** | 2 | Server info, action confirmation |

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

> **Beta** — Banter is under active development. Bug reports and pull requests are welcome.

Banter is a real-time team messaging platform built natively into the BigBlueBam suite. Channels, direct messages, threaded conversations, voice and video calls, and AI agent participation — all deeply integrated with your project board, knowledge base, and helpdesk.

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
| **Bam Integration** | Stable | Task references, Share to Banter, activity feed bot |
| **47 MCP Tools** | Stable | Full AI agent access to all messaging features |

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

AI agents can interact with Banter through **47 dedicated MCP tools**:

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

## Beacon

Beacon is the knowledge base platform built into the BigBlueBam suite. It keeps curated, expiry-aware knowledge fresh and discoverable -- by humans and AI agents alike.

Unlike a wiki that silently rots, Beacon treats every article as a living document with a verification lifecycle. Governance policies define how often content must be re-verified; stale Beacons are surfaced automatically through the **Fridge Cleanout** workflow so nothing quietly expires into irrelevance.

<p align="center">
  <img src="images/beacon-home.png" alt="Beacon Knowledge Home" width="100%" />
</p>
<p align="center"><em>Knowledge Home -- hub nodes, recent activity, and expiry alerts at a glance</em></p>

### Key Features

| Feature | Description |
|---------|-------------|
| **Semantic + Graph Search** | Hybrid retrieval combining vector similarity (Qdrant), knowledge-graph expansion, and PostgreSQL full-text fallback |
| **Expiry Governance (Fridge Cleanout)** | Hierarchical policies (org > project) define verification intervals, grace periods, and auto-archive rules |
| **Knowledge Graph Explorer** | Visual graph of Beacons connected by typed links (RelatedTo, Supersedes, DependsOn, ConflictsWith, SeeAlso) and implicit tag-affinity edges |
| **Versioned Content** | Every edit creates a new version; full history with diff support |
| **Agent-Native Verification** | AI agents can verify, challenge, publish, and retire Beacons through 29 dedicated MCP tools |
| **Saved Queries** | Named search configurations (private, project, or org-scoped) for reusable retrieval patterns |
| **Hierarchical Policies** | Org-level defaults with project-level overrides; `beacon_policy_resolve` previews the effective merged policy |

<p align="center">
  <img src="images/beacon-graph.png" alt="Beacon Graph Explorer" width="100%" />
</p>
<p align="center"><em>Knowledge Graph Explorer -- visualize connections between Beacons</em></p>

### Beacon MCP Tools

AI agents interact with Beacon through **29 dedicated MCP tools**:

| Category | Tools | What they do |
|----------|-------|-------------|
| **CRUD** | `beacon_create`, `beacon_list`, `beacon_get`, `beacon_update`, `beacon_retire`, `beacon_publish`, `beacon_verify`, `beacon_challenge`, `beacon_restore`, `beacon_versions`, `beacon_version_get` | Full lifecycle management with versioning |
| **Search** | `beacon_search`, `beacon_suggest`, `beacon_search_context` | Hybrid semantic + keyword + graph search, typeahead, agent-optimized retrieval |
| **Policy** | `beacon_policy_get`, `beacon_policy_set`, `beacon_policy_resolve` | Governance policy management and resolution |
| **Tags & Links** | `beacon_tags_list`, `beacon_tag_add`, `beacon_tag_remove`, `beacon_link_create`, `beacon_link_remove` | Tag management and typed inter-Beacon links |
| **Saved Queries** | `beacon_query_save`, `beacon_query_list`, `beacon_query_get`, `beacon_query_delete` | Reusable search configurations |
| **Graph** | `beacon_graph_neighbors`, `beacon_graph_hubs`, `beacon_graph_recent` | Knowledge graph traversal and exploration |

---

## Brief

Brief is a collaborative document editor built into the BigBlueBam suite. Its rich-text collaborative editor features a formatting toolbar, auto-generated table of contents, and slash commands -- plus real-time co-editing, templates, version history, and a graduation path that lets polished documents become Beacons when they mature into lasting knowledge.

<p align="center">
  <img src="images/brief-home.png" alt="Brief Home" width="100%" />
</p>
<p align="center"><em>Brief Home -- recent documents, templates, and quick-create actions</em></p>

### Key Features

| Feature | Description |
|---------|-------------|
| **WYSIWYG Editor** | Tiptap-based rich text with formatting toolbar, heading dropdown, tables, code blocks, task lists, and syntax highlighting |
| **Auto Table of Contents** | Generated in real-time from document headings, clickable to navigate |
| **Collaborative Editing** | Real-time multi-user editing with presence cursors, conflict-free merging, and per-paragraph locking |
| **33 Built-in Templates** | Meeting notes, PRDs, RFCs, post-mortems, onboarding guides, and more across 7 categories |
| **Brief-to-Beacon Graduation** | Promote a finished document to a Beacon with one click -- metadata, tags, and links carry over |
| **Cross-Product Linking** | Reference tasks (`BBB-247`), Banter messages, and Beacons inline with rich previews |
| **Version History** | Every save creates a version; full diff view and one-click restore |
| **Inline Comments** | Highlight any text and leave a comment thread -- resolved threads collapse automatically |
| **Semantic Search** | Find documents by meaning via Qdrant vector search, not just keywords |
| **18 MCP Tools** | AI agents can create, edit, search, comment on, and graduate documents programmatically |

<p align="center">
  <img src="images/brief-documents.png" alt="Document Browser" width="100%" />
</p>
<p align="center"><em>Document browser -- filter by project, author, template, and status</em></p>

<table>
  <tr>
    <td width="50%"><img src="images/brief-editor.png" alt="Brief WYSIWYG Editor — new document" width="100%" /></td>
    <td width="50%"><img src="images/brief-editor-with-content.png" alt="Brief WYSIWYG Editor — editing" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>WYSIWYG editor with formatting toolbar and Table of Contents</em></td>
    <td align="center"><em>Editing an existing document with rich text</em></td>
  </tr>
</table>

<p align="center">
  <img src="images/brief-templates.png" alt="Brief Template Library" width="100%" />
</p>
<p align="center"><em>33 built-in templates across 7 categories — business operations, engineering, strategy, HR, communications, sales, and creative</em></p>

<table>
  <tr>
    <td width="50%"><img src="images/brief-template-meeting-notes.png" alt="Meeting Notes template loaded in editor" width="100%" /></td>
    <td width="50%"><img src="images/brief-template-prd.png" alt="PRD template loaded in editor" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>Meeting Notes template — agenda, attendees, action items with checkboxes</em></td>
    <td align="center"><em>PRD template — metadata table, problem statement, requirements, rollout plan</em></td>
  </tr>
</table>

### Brief MCP Tools

AI agents interact with Brief through **18 dedicated MCP tools**:

| Category | Tools | What they do |
|----------|-------|-------------|
| **CRUD** | `brief_create`, `brief_list`, `brief_get`, `brief_update`, `brief_delete`, `brief_publish`, `brief_archive` | Full document lifecycle management |
| **Collaboration** | `brief_comment_add`, `brief_comment_list`, `brief_comment_resolve` | Inline comment threads |
| **Versions** | `brief_versions`, `brief_version_get`, `brief_version_restore` | Version history and restore |
| **Search** | `brief_search`, `brief_suggest` | Semantic and keyword search, typeahead suggestions |
| **Graduation** | `brief_graduate_to_beacon` | Promote a document to a Beacon with metadata carry-over |
| **Templates** | `brief_template_list`, `brief_template_create` | Template management |

---

## Bolt

Bolt is a visual workflow automation engine built into the BigBlueBam suite. Define trigger→condition→action rules that span every product in the platform, compile down to MCP tool calls, and execute with a full auditable log. No code required -- just wire up events, set conditions, and pick actions from a categorized menu.

<p align="center">
  <img src="images/bolt-automations.png" alt="Bolt Automation List" width="100%" />
</p>
<p align="center"><em>Automation dashboard -- 12 active rules with trigger badges, enable toggles, and execution history</em></p>

### Key Features

| Feature | Description |
|---------|-------------|
| **Visual Rule Builder** | WHEN→IF→THEN editor with color-coded sections, event catalog dropdown, and grouped action picker |
| **Event-Driven** | 26 events across 6 sources (Bam, Banter, Beacon, Brief, Helpdesk, Schedule) |
| **Condition Engine** | 13 operators (equals, contains, regex, gt/lt, in, between, isEmpty, etc.) with AND/OR grouping |
| **MCP-Native Actions** | Every action is an MCP tool call selected from a categorized menu -- same permissions, same audit trail |
| **Execution Audit Log** | Every run is recorded with trigger context, condition evaluation, action results, and duration |
| **Pre-Built Templates** | 10 starter templates covering common patterns (helpdesk triage, sprint reminders, stale-task alerts) |
| **Rate Limiting & Cooldowns** | Per-rule rate limits and cooldown windows prevent runaway automations |
| **AI-Assisted Authoring** | Describe what you want in plain English; an AI agent drafts the rule for you (requires LLM provider) |
| **Schedule Triggers (cron)** | Time-based triggers using cron expressions for recurring automations |
| **12 MCP Tools** | AI agents can create, manage, and inspect automations programmatically |

<table>
  <tr>
    <td width="50%"><img src="images/bolt-editor-existing.png" alt="Bolt Visual Builder — editing an existing automation" width="100%" /></td>
    <td width="50%"><img src="images/bolt-editor-new.png" alt="Bolt Visual Builder — new automation" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>Editing "Notify on Critical Task" — WHEN/IF/THEN flow with live event catalog</em></td>
    <td align="center"><em>New automation — pick a trigger source and event, add conditions, select actions</em></td>
  </tr>
</table>

<table>
  <tr>
    <td width="50%"><img src="images/bolt-templates.png" alt="Bolt Automation Templates" width="100%" /></td>
    <td width="50%"><img src="images/bolt-executions.png" alt="Bolt Execution Log" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>10 pre-built templates — start from a proven pattern and customize</em></td>
    <td align="center"><em>Execution log — every run traced with status, duration, and step detail</em></td>
  </tr>
</table>

### Bolt MCP Tools

AI agents interact with Bolt through **12 dedicated MCP tools**:

| Category | Tools | What they do |
|----------|-------|-------------|
| **CRUD** | `bolt_list`, `bolt_get`, `bolt_create`, `bolt_update`, `bolt_delete` | Full automation lifecycle management |
| **Control** | `bolt_enable`, `bolt_disable`, `bolt_test` | Enable/disable and test-fire automations |
| **Executions** | `bolt_executions`, `bolt_execution_detail` | Execution history and step-by-step detail |
| **Discovery** | `bolt_events`, `bolt_actions` | Browse available triggers and MCP tool actions |

---

## Bearing

Bearing is the Goals & OKR tracking module in BigBlueBam. It provides hierarchical time-boxed periods (quarters, halves, or custom ranges), measurable key results linked to objectives, and automatic progress computation from linked Bam tasks and epics. Goals are auto-classified as on_track, at_risk, behind, or achieved based on progress versus timeline position, giving leadership real-time visibility into whether the team is on track -- without requiring manual progress updates.

<p align="center">
  <img src="images/bearing-dashboard.png" alt="Goals Dashboard — dark mode" width="100%" />
</p>
<p align="center"><em>Goals Dashboard -- summary stats (total, average progress, at risk, achieved) with scope filtering by org, team, or project</em></p>

### Key Features

| Feature | Description |
|---------|-------------|
| **OKR Framework** | Objectives with measurable key results, progress tracking |
| **Period Management** | Quarters, halves, or custom periods with lifecycle (planning → active → completed) |
| **Auto-Progress** | Key results can link to Bam tasks/epics for automatic progress computation |
| **Status Engine** | Goals auto-classified as on_track, at_risk, behind, achieved based on progress vs timeline |
| **Dashboard** | Summary stats (total, avg progress, at risk, achieved) with scope filtering (org/team/project) |
| **Status Updates** | Team members post updates on goal progress with status snapshots |
| **Watchers** | Subscribe to goals for notifications |
| **12 MCP Tools** | AI agents can manage periods, goals, key results, and updates programmatically |

<table>
  <tr>
    <td width="50%"><img src="images/bearing-goal-detail.png" alt="Goal Detail" width="100%" /></td>
    <td width="50%"><img src="images/bearing-at-risk.png" alt="At Risk Goals" width="100%" /></td>
  </tr>
  <tr>
    <td>Goal detail — key results with progress bars, status updates, watchers</td>
    <td>At Risk view — goals behind schedule that need attention</td>
  </tr>
</table>

### Bearing MCP Tools

AI agents interact with Bearing through **12 dedicated MCP tools**:

| Category | Tools | What they do |
|----------|-------|-------------|
| **Periods** | `bearing_periods`, `bearing_period_get` | List/manage time periods, get period with summary stats |
| **Goals** | `bearing_goals`, `bearing_goal_get`, `bearing_goal_create`, `bearing_goal_update` | Full goal lifecycle -- list, detail, create, update |
| **Key Results** | `bearing_kr_create`, `bearing_kr_update`, `bearing_kr_link` | Create and update key results, link KRs to Bam entities |
| **Updates** | `bearing_update_post`, `bearing_report`, `bearing_at_risk` | Post status updates, generate reports, list at-risk goals |

---

## Board

Board is an infinite-canvas visual collaboration whiteboard built into the BigBlueBam suite. Think of it as Miro meets your project board — teams brainstorm on sticky notes, sketch architecture diagrams, run retrospectives, and then promote the outcomes directly into Bam tasks without leaving the canvas. Built-in voice chat means your distributed team can talk while they draw, and a persistent side chat captures the conversation for anyone who joins later.

<p align="center">
  <img src="images/board-list.png" alt="Board whiteboard grid" width="100%" />
</p>
<p align="center"><em>Board grid — 8 active whiteboards with icons, project badges, and collaboration indicators</em></p>

### How Teams Use Board

**Sprint Retrospectives:** The team opens a "Start / Stop / Continue" template. Three color-coded frames appear. Everyone drops sticky notes simultaneously — green for what went well, red for what didn't. At the end, the facilitator multi-selects the action items and clicks "Create Tasks" to push them straight into the next sprint.

**Architecture Workshops:** A tech lead opens the Architecture Diagram template with pre-positioned frames for Frontend, Backend, Database, and External Services. The team sketches out a new system design with shapes and connectors. The final board embeds live Bam task cards for each workstream and gets linked to the Brief design spec.

**Brainstorming Sessions:** Product and engineering gather around a 65" touchscreen (or their laptops from home). The canvas starts blank. Someone types the topic in a frame. Ideas flow as sticky notes — the AI reads the board through MCP, identifies clusters, and proposes a task breakdown. Everyone's talking through the built-in audio while watching cursors move in real-time.

**Remote Design Sprints:** Over five days, the team cycles through Understand, Sketch, Decide, Prototype, Test — each with its own frame on the board. Sticky notes accumulate, diagrams form, and the chat panel captures design rationale. At the end of the sprint, the board becomes the living record of how decisions were made.

### Key Features

| Feature | Description |
|---------|-------------|
| **Infinite Canvas** | tldraw-based zoomable canvas with shapes, sticky notes, freehand drawing, images, frames, and text |
| **Real-Time Collaboration** | Multi-user CRDT sync — every collaborator sees live cursors, selections, and edits in real-time |
| **Built-in Audio** | LiveKit-powered voice conferencing within each board — auto-join, mute/unmute, speaker indicators |
| **Side Chat** | Persistent chat panel for text conversation alongside the canvas — history loads for late joiners |
| **Sticky-to-Task Pipeline** | Multi-select sticky notes → Create Tasks → pushed to Bam with titles, descriptions, and backlinks |
| **Cross-Product Embeds** | Embed live Bam task cards, Beacon articles, Brief documents, and Bearing goals on the canvas |
| **10 Templates** | Start/Stop/Continue, 4Ls Retro, Sailboat, Brainstorm, Affinity Map, User Story Map, Architecture, Flowchart, SWOT, Blank |
| **Multitouch** | Pinch-to-zoom and two-finger pan on touch devices, including large touchscreens |
| **AI Canvas Reading** | 14 MCP tools let agents read canvas content, add stickies, promote to tasks, and summarize themes |

<table>
  <tr>
    <td width="50%"><img src="images/board-canvas-retro.png" alt="Board canvas — sprint retrospective with smiley" width="100%" /></td>
    <td width="50%"><img src="images/board-canvas-brainstorm.png" alt="Board canvas — feature brainstorm" width="100%" /></td>
  </tr>
  <tr>
    <td align="center"><em>Sprint retro — sticky notes, freehand smiley face, and text on the canvas</em></td>
    <td align="center"><em>Feature brainstorm — sticky notes with ideas on the infinite canvas</em></td>
  </tr>
</table>

<p align="center">
  <img src="images/board-templates.png" alt="Board template gallery" width="100%" />
</p>
<p align="center"><em>10 built-in templates — retrospective formats, brainstorming, architecture diagrams, and more</em></p>

### Board MCP Tools

AI agents interact with Board through **14 dedicated MCP tools**:

| Category | Tools | What they do |
|----------|-------|-------------|
| **CRUD** | `board_list`, `board_get`, `board_create`, `board_update`, `board_archive` | Full board lifecycle management |
| **Reading** | `board_read_elements`, `board_read_stickies`, `board_read_frames` | Structured canvas content for AI analysis |
| **Writing** | `board_add_sticky`, `board_add_text` | Programmatically add content to the canvas |
| **Actions** | `board_promote_to_tasks`, `board_export` | Convert stickies to Bam tasks, export as SVG/PNG |
| **Discovery** | `board_summarize`, `board_search` | Summarize themes, search across all boards |

---

## Bond

Bond is the CRM (Customer Relationship Management) module built into the BigBlueBam suite. It provides a visual deal pipeline board, contact and company management, activity logging, and deep cross-product integration -- so your sales process lives alongside your project board, helpdesk, and knowledge base instead of in a separate tool.

Deals flow through configurable pipeline stages displayed as a Kanban board, making it easy to see the full sales funnel at a glance. Each deal links to a company and one or more contacts, carries a value and expected close date, and tracks every touchpoint through an activity timeline. When a deal closes, a Bolt automation can create the onboarding project in Bam, post the win to a Banter channel, and generate a customer Beacon -- all automatically.

### Key Features

| Feature | Description |
|---------|-------------|
| **Pipeline Board** | Kanban-style deal board with configurable stages, drag-and-drop, and weighted pipeline value per stage |
| **Contacts & Companies** | Full contact database with company hierarchy, custom fields, tags, and merge/duplicate detection |
| **Deal Tracking** | Value, expected close date, probability, owner, linked contacts, and stage history |
| **Activity Timeline** | Log calls, emails, meetings, notes, and tasks against contacts, companies, or deals |
| **Cross-Product Links** | Link deals to Bam projects, Helpdesk tickets, Beacon articles, and Brief documents |
| **Search** | Full-text and semantic search across contacts, companies, deals, and activity notes |
| **Pipeline Reports** | Conversion rates, average deal size, stage duration, forecast, and win/loss analysis |
| **19 MCP Tools** | AI agents can manage the full CRM lifecycle programmatically |

### Bond MCP Tools

AI agents interact with Bond through **19 dedicated MCP tools**:

| Category | Tools | What they do |
|----------|-------|-------------|
| **Contacts** | `bond_contact_list`, `bond_contact_get`, `bond_contact_create`, `bond_contact_update` | Contact lifecycle management with search and filtering |
| **Companies** | `bond_company_list`, `bond_company_get`, `bond_company_create`, `bond_company_update` | Company management with hierarchy and linked contacts |
| **Deals** | `bond_deal_list`, `bond_deal_get`, `bond_deal_create`, `bond_deal_update`, `bond_deal_move` | Deal CRUD and pipeline stage advancement |
| **Activities** | `bond_activity_log`, `bond_activity_list` | Log and retrieve calls, emails, meetings, notes |
| **Pipeline** | `bond_pipeline_get`, `bond_pipeline_report` | Pipeline configuration and reporting |
| **Search** | `bond_search` | Cross-entity search across contacts, companies, deals, and activities |

---

## AI Provider Configuration

BigBlueBam features a hierarchical LLM provider configuration system that powers AI features across the suite — including Bolt's AI-assisted automation authoring, future summarization, and content generation features.

### How It Works

Providers are configured at three levels, with the most specific taking precedence:

| Scope | Who Configures | Applies To |
|-------|---------------|-----------|
| **System** | SuperUser | All organizations (fallback default) |
| **Organization** | Org Admin/Owner | All projects in the org |
| **Project** | Project Admin | Only that project |

### Supported Providers

| Provider | Type | Notes |
|----------|------|-------|
| **Anthropic** | `anthropic` | Claude models. Uses default API endpoint. |
| **OpenAI** | `openai` | GPT models. Uses default API endpoint. |
| **OpenAI-Compatible** | `openai_compatible` | Any endpoint implementing the OpenAI Chat Completions API — Azure OpenAI, Together AI, Ollama, vLLM, local LLMs, etc. Requires custom `api_endpoint`. |

### Security

- API keys are **encrypted at rest** using AES-256-GCM with the server's `SESSION_SECRET`
- Keys are **never returned in full** — always redacted to `sk-•••XXXX` (last 4 characters only)
- Scope-based authorization ensures only the right roles can configure each level
- Test Connection verifies credentials work before saving

### Setup

Configure providers in **Settings → AI Providers** in the Bam frontend. If no provider is configured, AI-dependent features (like Bolt's "Describe your automation" dialog) show a helpful message directing admins to the setup page.

---

## Quick Start

> **📖 Full deployment guide:** [docs/deployment-guide.md](docs/deployment-guide.md) — step-by-step walkthrough with interactive setup wizard, password generation, and platform selection (Docker Compose for self-hosted; Railway for managed cloud — both fully automated).

### Guided Setup (Recommended)

The interactive deploy script handles everything — installs dependencies, generates secrets, provisions infrastructure, and creates your admin account:

```bash
git clone https://github.com/eoffermann/BigBlueBam.git
cd BigBlueBam

# Linux / macOS
./scripts/deploy.sh

# Windows (PowerShell)
.\scripts\deploy.ps1
```

### Manual Setup with Docker Compose

If you prefer to set things up manually:

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

#### Provision the internal MCP service account

Bolt automations and the background worker invoke MCP tools over an internal HTTP path (`POST /mcp/tools/call`) instead of holding a persistent MCP session. That path is authenticated two ways: a shared secret (`INTERNAL_SERVICE_SECRET`, already generated by `cp .env.example .env` or the deploy script) plus a bearer token tied to a dedicated service-account user that `mcp-server` uses to talk to the rest of the stack on behalf of internal callers.

If `MCP_INTERNAL_API_TOKEN` is blank in your `.env`, `mcp-server` still boots and external MCP clients (Claude Desktop, Claude Code) work fine — but every call to `POST /mcp/tools/call` returns HTTP 503 with `INTERNAL_NOT_CONFIGURED`, which means **Bolt automations that invoke MCP tools will fail** and any worker job relying on the internal path won't be able to call MCP tools either. For a self-hosted single-operator setup you can leave it blank; for anything that needs Bolt-to-MCP integration, provision the token once:

```bash
# 1. Mint a service account + API key (prefix bbam_svc_). The --org-slug
#    is the one you created with create-admin above; slugify() lowercases
#    and hyphenates the --org value (e.g. "My Organization" becomes
#    "my-organization"). Run `docker compose exec api node dist/cli.js list-orgs`
#    if you're not sure.
docker compose exec api node dist/cli.js create-service-account \
  --name mcp-internal \
  --org-slug my-organization

# 2. The command prints a token once:
#       Token:      bbam_svc_abcdef0123456789...
#    Copy that value (not the command output around it) and paste it into .env:
#       MCP_INTERNAL_API_TOKEN=bbam_svc_abcdef0123456789...

# 3. Restart mcp-server so it picks up the new env var.
docker compose up -d --force-recreate mcp-server
```

You only need to do this once per stack. If you wipe the postgres volume you will need to re-mint the token because the service-account user lives in the database. The token is not rotated automatically; to rotate, mint a new service account with a different `--name`, swap the env var, restart, then delete the old service-account user via `docker compose exec api node dist/cli.js revoke-api-key --prefix bbam_svc`.

Open **http://localhost/b3/** to access BigBlueBam, **http://localhost/banter/** for Banter, **http://localhost/beacon/** for Beacon, **http://localhost/brief/** for Brief, **http://localhost/bolt/** for Bolt, **http://localhost/bearing/** for Bearing, **http://localhost/board/** for Board, **http://localhost/bond/** for Bond CRM, or **http://localhost/helpdesk/** for the helpdesk portal.

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
| `/b3/` | nginx | Bam React SPA |
| `/b3/api/` | Fastify `:4000` | Bam REST API |
| `/b3/ws` | Fastify `:4000` | WebSocket (real-time updates) |
| `/banter/` | nginx | Banter team messaging SPA |
| `/banter/api/` | Fastify `:4002` | Banter REST API |
| `/banter/ws` | Fastify `:4002` | Banter WebSocket (real-time messaging) |
| `/helpdesk/` | nginx | Helpdesk portal SPA |
| `/helpdesk/api/` | Fastify `:4001` | Helpdesk API (auth, tickets, messages) |
| `/files/` | MinIO `:9000` | Uploaded files (shared) |
| `/beacon/` | nginx | Beacon knowledge base SPA |
| `/beacon/api/` | Fastify `:4004` | Beacon REST API |
| `/brief/` | nginx | Brief collaborative document editor SPA |
| `/brief/api/` | Fastify `:4005` | Brief REST API |
| `/brief/ws` | Fastify `:4005` | Brief WebSocket (real-time co-editing) |
| `/bolt/` | nginx | Bolt workflow automation SPA |
| `/bolt/api/` | Fastify `:4006` | Bolt REST API |
| `/bearing/` | nginx | Bearing Goals & OKRs SPA |
| `/bearing/api/` | Fastify `:4007` | Bearing REST API |
| `/board/` | nginx | Board visual collaboration SPA |
| `/board/api/` | Fastify `:4008` | Board REST API |
| `/board/ws` | Fastify `:4008` | Board WebSocket (real-time canvas sync) |
| `/bond/` | nginx | Bond CRM SPA |
| `/bond/api/` | Fastify `:4009` | Bond REST API |
| `/mcp/` | MCP Server `:3001` | Model Context Protocol (215 tools) |

Infrastructure services (internal, not exposed via nginx):

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | `:5432` | Primary database |
| Redis | `:6379` | Cache, PubSub, queues |
| MinIO | `:9000` | S3-compatible file storage |
| Worker | -- | BullMQ background job processor |
| LiveKit | `:7880` | Voice/video SFU (WebRTC media server) |
| Beacon API | `:4004` | Beacon knowledge base REST API |
| Qdrant | `:6333` | Vector search engine (semantic embeddings) |
| Voice Agent | `:4003` | AI voice call participation (Python/FastAPI) |

### Development Mode

```bash
pnpm install
pnpm --filter @bigbluebam/shared build
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Run Tests

```bash
pnpm test  # 900+ tests across all packages
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
│  /b3/          → Bam SPA (static)               ││
│  /b3/api/      → Fastify API :4000             ││
│  /b3/ws        → WebSocket :4000               ││
│  /banter/      → Banter SPA (static)           ││
│  /banter/api/  → Banter API :4002              ││
│  /banter/ws    → Banter WebSocket :4002        ││
│  /beacon/      → Beacon SPA (static)           ││
│  /beacon/api/  → Beacon API :4004              ││
│  /brief/       → Brief SPA (static)            ││
│  /brief/api/   → Brief API :4005               ││
│  /brief/ws     → Brief WebSocket :4005         ││
│  /bolt/        → Bolt SPA (static)             ││
│  /bolt/api/    → Bolt API :4006                ││
│  /bearing/     → Bearing SPA (static)          ││
│  /bearing/api/ → Bearing API :4007             ││
│  /board/       → Board SPA (static)            ││
│  /board/api/   → Board API :4008               ││
│  /board/ws     → Board WebSocket :4008         ││
│  /bond/        → Bond SPA (static)             ││
│  /bond/api/    → Bond API :4009                ││
│  /helpdesk/    → Helpdesk SPA (static)         ││
│  /helpdesk/api/→ Helpdesk API :4001            ││
│  /files/       → MinIO :9000                   ││
│  /mcp/         → MCP Server :3001              ││
└──────┬──────────┬──────────┬───────────────────┘│
       │          │          │                     │
┌──────▼────┐ ┌──▼───────┐ ┌▼──────────┐ ┌──────────┐ ┌───────▼──────┐ ┌──────────┐
│ Bam API   │ │ Banter   │ │ MCP Server│ │ Brief    │ │ Bolt API │ │ LiveKit SFU  │ │ Worker   │
│ :4000     │ │ API :4002│ │ :3001     │ │ API :4005│ │ :4006    │ │ :7880 (voice)│ │ BullMQ   │
│ +WebSocket│ │ +WS      │ │ 215 tools │ │ +WS      │ │          │ │ +voice-agent │ │ jobs     │
└─────┬─────┘ └────┬─────┘ └─────┬─────┘ └────┬─────┘ └──────────────┘ └────┬─────┘
      │             │             │            │                  │
┌─────▼─────────────▼─────────────▼────────────▼───────────────────▼───┐
│  PostgreSQL 16  │  Redis 7        │  MinIO (S3)   │  Qdrant (vectors)    │
│  40+ tables     │  PubSub + cache │  File storage │  Semantic search     │
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
| **Database** | PostgreSQL 16, Redis 7, MinIO, Qdrant |
| **Worker** | BullMQ, Nodemailer |
| **Build** | Turborepo, pnpm workspaces, tsup, Vite |
| **Testing** | Vitest (900+ tests) |
| **Deploy** | Docker Compose, multi-stage Dockerfiles |

### Monorepo Structure

```
apps/
  api/              → Fastify REST API + WebSocket (23 route modules)
  frontend/         → React SPA (33 components, 8 pages)
  mcp-server/       → MCP protocol server (215 tools)
  worker/           → BullMQ background jobs (incl. Banter notifications & retention)
  helpdesk-api/     → Helpdesk Fastify API (auth, tickets, messages)
  helpdesk/         → Helpdesk React SPA (client-facing portal)
  banter-api/       → Banter Fastify API + WebSocket (15 route modules, 18 DB tables)
  banter/           → Banter React SPA (14 components, 7 pages)
  beacon-api/       → Beacon Fastify API (knowledge base, search, graph, policies)
  beacon/           → Beacon React SPA (knowledge home, graph explorer, editor)
  brief-api/        → Brief Fastify REST API + WebSocket (8 route modules, 11 DB tables)
  brief/            → Brief React SPA (collaborative editor, templates, version history)
  bolt-api/         → Bolt Fastify REST API (workflow automation, rules, executions)
  bolt/             → Bolt React SPA (visual rule builder, execution log, templates)
  bearing-api/      → Bearing Fastify REST API (goals, key results, progress, reporting)
  bearing/          → Bearing React SPA (goal dashboard, timeline, detail views)
  board-api/        → Board Fastify REST API + WebSocket (whiteboard rooms, shapes, assets, conferencing)
  board/            → Board React SPA (infinite canvas, real-time collaboration, audio conferencing)
  bond-api/         → Bond Fastify REST API (contacts, companies, deals, pipeline, activities)
  bond/             → Bond React SPA (pipeline board, contact/company detail, deal tracking)
  voice-agent/      → AI voice agent (Python/FastAPI, LiveKit Agents SDK)
packages/
  shared/           → Zod schemas, TypeScript types, constants
infra/
  postgres/         → Database schema (init.sql — 40+ tables)
  nginx/            → Reverse proxy config (single nginx serves all SPAs)
  livekit/          → LiveKit SFU configuration
docs/               → 8 documentation pages with Mermaid diagrams
scripts/            → Utility and seed scripts
```

### Key Numbers

| Metric | Count |
|--------|-------|
| Docker services | 19 |
| MCP tools | 215 (64 Bam + 47 Banter + 29 Beacon + 18 Brief + 12 Bolt + 12 Bearing + 14 Board + 19 Bond) |
| Test cases | 900+ |
| API route modules | 46 (23 Bam + 15 Banter + 8 Brief) |
| Database tables | 51+ (25 Bam + 18 Banter + 11 Brief) |
| Frontend components | 47+ (33 Bam + 14 Banter) |
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
| [Deployment Guide](docs/deployment-guide.md) | Interactive setup wizard, Docker Compose and Railway, step-by-step |
| [Deployment](docs/deployment.md) | Docker, Kubernetes, scaling, backup |
| [Development](docs/development.md) | Contributing, testing, code style |
| [Helpdesk Design](BigBlueBam_Helpdesk_Design_Document.md) | Helpdesk ticketing system design |
| [Banter Design](Banter_Design_Document.md) | Team messaging & voice/video design |
| [Beacon Design](Beacon_Design_Document.md) | Knowledge base platform design |
| [Bond Design](Bond_Design_Document.md) | CRM pipeline and contact management design |

---

## License

MIT -- see [LICENSE](LICENSE).

---

<p align="center">
  Built with <a href="https://claude.ai/code">Claude Code</a>
</p>
