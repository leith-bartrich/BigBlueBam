# Permissions & Authorization

This document defines the BigBlueBam permission model — the hierarchy of roles, what each role can do, and how permissions are enforced across the B3 project management app, Banter team messaging, and the Helpdesk portal.

---

## Role Hierarchy

BigBlueBam uses a layered permission model. Higher-scoped roles inherit authority over everything beneath them.

```
SuperUser                          ← Platform-wide. Above all organizations.
  └─ Organization                  ← A tenant boundary. Isolates all data.
       ├─ Owner                    ← Full org control. One per org (the creator).
       ├─ Admin                    ← Org management. Cannot delete org or demote owner.
       ├─ Member                   ← Standard user. Creates, edits, collaborates.
       ├─ Viewer                   ← Read-only. Cannot create or modify anything.
       └─ Guest                    ← Limited-scope. Invited to specific projects/channels.
            │
            ├─ Project (B3)
            │    ├─ Project Admin   ← Manages phases, sprints, members for this project.
            │    └─ Project Member  ← Creates/edits tasks, comments, time entries.
            │
            └─ Channel (Banter)
                 ├─ Channel Owner   ← Channel creator. Can archive, transfer ownership.
                 ├─ Channel Admin   ← Manages members, pins, can delete any message.
                 └─ Channel Member  ← Posts messages, reacts, manages own messages.
```

---

## 1. SuperUser

**Scope:** Platform-wide. Operates above the organization boundary.

A SuperUser is a platform administrator who manages the BigBlueBam deployment itself. In a self-hosted deployment, this is the person who runs `docker compose up`. In a managed/SaaS deployment, this is the platform operator.

### What SuperUsers can do

| Action | Description |
|--------|-------------|
| Create organizations | Provision new tenant organizations |
| Modify any organization | Change name, plan, settings, logo for any org |
| Delete organizations | Permanently remove an org and all its data |
| List all organizations | See every org on the platform |
| Impersonate any user | Act as any user for debugging/support (with audit trail) |
| View any org's data | Access projects, channels, tickets across all orgs |
| Manage platform settings | Configure global defaults, feature flags, SMTP, etc. |
| Create users in any org | Add users to any organization without an invite |
| Promote/demote org owners | Change who owns an organization |
| Access system health | View logs, metrics, queue status, storage usage |
| Manage API keys for any org | Create, revoke, or inspect any API key |

### How SuperUser is identified

SuperUser status is **not** an org-level role. It is a separate flag on the user record:

```
users.is_superuser: boolean (default: false)
```

A SuperUser must still belong to at least one organization (their "home org"), but their authority extends across all organizations. The `is_superuser` flag is checked in middleware **before** any org-scoped permission check, and bypasses org/project/channel role requirements.

### Creating the first SuperUser

The first SuperUser is created via the CLI during deployment:

```bash
docker compose exec api node dist/cli.js create-admin \
  --email admin@example.com \
  --password SecurePassword \
  --name "Platform Admin" \
  --org "Platform" \
  --superuser
```

Additional SuperUsers can only be created by an existing SuperUser through the platform admin panel or CLI. Org owners cannot promote themselves to SuperUser.

### SuperUser audit trail

All SuperUser actions that cross org boundaries are logged to a dedicated `superuser_audit_log` table:

| Field | Description |
|-------|-------------|
| `id` | UUID |
| `superuser_id` | The SuperUser performing the action |
| `action` | e.g., `org.created`, `org.deleted`, `user.impersonated` |
| `target_org_id` | The affected organization (nullable) |
| `target_user_id` | The affected user (nullable) |
| `details` | JSONB with action-specific metadata |
| `ip_address` | Request origin |
| `created_at` | Timestamp |

---

## 2. Organization Roles

**Scope:** All resources within a single organization.

Every user belongs to one or more organizations (via `organization_memberships`) and holds a role within each.

> **Current state:** Users have a single `org_id` FK. The planned migration to `organization_memberships` (many-to-many) is tracked as a known TODO. The permission model below is designed for the multi-org future.

### Role: Owner

The organization creator. Exactly one user holds this role per org.

| Action | Allowed |
|--------|---------|
| Update org name, logo, plan, settings | Yes |
| Delete / archive the organization | Yes |
| Invite members | Yes |
| Remove any member (including admins) | Yes |
| Promote member → admin | Yes |
| Demote admin → member | Yes |
| Transfer ownership to another user | Yes |
| All Admin, Member, Viewer abilities | Yes |

### Role: Admin

Trusted managers who configure the org but don't own it.

| Action | Allowed |
|--------|---------|
| Update org settings | Yes |
| Invite members | Yes |
| Remove members (not owner) | Yes |
| Promote member → admin | Yes (cannot promote to owner) |
| Demote admin → member | Yes (cannot demote owner) |
| Delete the organization | **No** |
| Transfer ownership | **No** |
| All Member, Viewer abilities | Yes |

### Role: Member

Standard team member. The default role for invited users.

| Action | Allowed |
|--------|---------|
| View org details and member list | Yes |
| Create projects | Yes |
| Join public Banter channels | Yes |
| Start DMs | Yes |
| Use MCP tools (scoped to their projects) | Yes |
| Invite members | **No** |
| Change org settings | **No** |
| Remove members | **No** |

### Role: Viewer

Read-only access. For stakeholders who need visibility but shouldn't modify anything.

| Action | Allowed |
|--------|---------|
| View org details, members, projects | Yes |
| View tasks, comments, activity | Yes |
| View Banter channels they're a member of | Yes |
| Create tasks, comments, or messages | **No** |
| Modify any resource | **No** |
| Join channels or projects on their own | **No** |

### Role: Guest

Scoped external collaborator. Invited to specific projects or channels, with no org-wide visibility.

| Action | Allowed |
|--------|---------|
| View/edit in invited projects only | Yes |
| View/post in invited channels only | Yes |
| See org member list | **No** (only sees members of shared projects/channels) |
| Browse channels or projects | **No** |
| Create projects or channels | **No** |

---

## 3. Project Roles (B3)

**Scope:** A single project within an organization.

Assigned via `project_memberships`. A user can have different roles in different projects.

### Role: Project Admin

| Action | Allowed |
|--------|---------|
| Create/edit/delete/reorder phases | Yes |
| Create/start/complete sprints | Yes |
| Add/remove project members | Yes |
| Change project member roles | Yes |
| Update project settings | Yes |
| Archive/delete project | Yes |
| Create/edit/delete tasks | Yes |
| All Project Member abilities | Yes |

### Role: Project Member

| Action | Allowed |
|--------|---------|
| Create tasks | Yes |
| Edit tasks (any task in the project) | Yes |
| Move tasks between phases | Yes |
| Comment on tasks | Yes |
| Log time entries | Yes |
| Upload attachments | Yes |
| React to comments | Yes |
| Create/edit labels, epics, custom fields | **Proposed: No** (currently unguarded) |
| Manage phases or sprints | **No** |
| Add/remove project members | **No** |

---

## 4. Channel Roles (Banter)

**Scope:** A single Banter channel.

Assigned via `banter_channel_memberships`. Org-level Admin/Owner can override channel permissions.

### Role: Channel Owner

The channel creator. One per channel.

| Action | Allowed |
|--------|---------|
| Archive/delete channel | Yes |
| Transfer ownership | Yes |
| Change any member's role | Yes |
| All Channel Admin abilities | Yes |

### Role: Channel Admin

| Action | Allowed |
|--------|---------|
| Edit channel name, topic, description | Yes |
| Add/remove members | Yes |
| Pin/unpin messages | Yes |
| Delete any message | Yes |
| Change member → admin (not to owner) | Yes |
| All Channel Member abilities | Yes |

### Role: Channel Member

| Action | Allowed |
|--------|---------|
| View channel messages | Yes |
| Post messages | Yes |
| Reply in threads | Yes |
| React to messages | Yes |
| Upload files | Yes |
| Edit own messages | Yes |
| Delete own messages | Yes |
| Delete others' messages | **No** |
| Pin messages | **No** |
| Add/remove members | **No** |

---

## 5. API Key Scopes

API keys are issued per-user and carry a scope that restricts what operations the key can perform, independent of the user's role.

| Scope | Read | Create/Update | Delete | Admin |
|-------|------|---------------|--------|-------|
| **read** | Yes | No | No | No |
| **read_write** | Yes | Yes | Yes | No |
| **admin** | Yes | Yes | Yes | Yes |

API keys can also be restricted to specific projects via the `project_ids` array. When set, the key can only access resources within those projects.

> **Current state:** API key scopes are defined in the schema but not enforced in middleware. This is a known gap to be fixed.

---

## 6. Org-Level Override Rules

Organization-level roles provide fallback authority over project and channel resources:

| Org Role | Can override project permissions? | Can override channel permissions? |
|----------|----------------------------------|----------------------------------|
| **SuperUser** | Yes — full access to everything | Yes — full access to everything |
| **Owner** | Yes — treated as project admin everywhere | Yes — can edit/archive any channel, delete any message |
| **Admin** | Yes — treated as project admin everywhere | Yes — can edit/archive any channel, delete any message |
| **Member** | No — must be explicitly added to projects | No — must be explicitly added to channels |
| **Viewer** | No | No |
| **Guest** | No | No |

---

## 7. Permission Check Order

Every API request follows this evaluation sequence:

```
1. Is the user authenticated? (session cookie or API key)
   └─ No → 401 Unauthorized

2. Is the user a SuperUser?
   └─ Yes → Granted (log to superuser_audit_log)

3. Does the API key scope allow this operation?
   └─ No → 403 Forbidden ("API key scope insufficient")

4. Is the user active? (is_active = true)
   └─ No → 403 Forbidden ("Account deactivated")

5. Does the org-level role allow this operation?
   └─ If org admin/owner and the action is within their org → Granted
   └─ If the action requires org admin/owner and user is member → 403

6. Does the resource-level role allow this operation?
   └─ Check project_memberships or banter_channel_memberships
   └─ If role insufficient → 403 Forbidden

7. Does ownership/authorship apply?
   └─ e.g., "can delete own message" even without channel admin role
```

---

## 8. Enforcement Points

| Layer | Mechanism | File(s) | Status |
|-------|-----------|---------|--------|
| **Authentication** | `requireAuth` Fastify preHandler | `apps/api/src/plugins/auth.ts`, `apps/banter-api/src/plugins/auth.ts` | Implemented |
| **SuperUser check** | `requireSuperUser` middleware | `apps/api/src/plugins/auth.ts`, `apps/banter-api/src/plugins/auth.ts` | Implemented |
| **Minimum role** | `requireMinRole(role)` middleware (viewer < member < admin < owner) | `apps/api/src/plugins/auth.ts`, `apps/banter-api/src/plugins/auth.ts` | Implemented |
| **API key scope** | `requireScope(scope)` middleware (read < read_write < admin) | `apps/api/src/plugins/auth.ts`, `apps/banter-api/src/plugins/auth.ts` | Implemented |
| **Org role** | `requireOrgRole(...roles)` middleware | `apps/api/src/middleware/authorize.ts` | Implemented (SuperUser bypass added) |
| **Project role** | `requireProjectRole(...roles)` middleware | `apps/api/src/middleware/authorize.ts` | Implemented (SuperUser bypass added) |
| **Channel role** | Inline checks in route handlers | `apps/banter-api/src/routes/channel.routes.ts` | Implemented |
| **Authorship** | Inline `author_id === user.id` checks | Various route files | Implemented |
| **MCP scope errors** | `formatScopeError()` utility | `apps/mcp-server/src/middleware/scope-check.ts` | Implemented |
| **Platform admin** | SuperUser-only org CRUD routes | `apps/api/src/routes/platform.routes.ts` | Implemented |
| **SuperUser audit** | `superuser_audit_log` table | `apps/api/src/db/schema/superuser-audit-log.ts` | Implemented |

---

## 9. Known Gaps

| # | Gap | Severity | Status | Description |
|---|-----|----------|--------|-------------|
| 1 | ~~No SuperUser role~~ | ~~High~~ | **Resolved** | `is_superuser` column, `requireSuperUser` middleware, CLI `--superuser` flag, platform admin routes, audit log table. |
| 2 | ~~API key scopes not enforced~~ | ~~High~~ | **Resolved** | `requireScope(scope)` middleware enforced on all write/admin endpoints in B3 and Banter APIs. MCP server surfaces user-friendly scope errors. |
| 3 | ~~Viewer role not enforced~~ | ~~Medium~~ | **Resolved** | `requireMinRole('member')` added to all POST/PATCH/DELETE endpoints. Viewers get read-only access. |
| 4 | ~~Guest role not implemented~~ | ~~Medium~~ | **Resolved** | `guest_invitations` table, invitation API, auto-provisioning of guest users with scoped project/channel access. |
| 5 | ~~Many B3 endpoints unguarded~~ | ~~Medium~~ | **Resolved** | All 9 remaining route files (labels, epics, custom-fields, webhooks, views, templates, attachments, time-entries, reactions) now guarded with viewer/scope/project-role checks. |
| 6 | **Single org_id on users** | Medium | In Progress | `organization_memberships` table added with migration script. Auth plugins read active org context from header/default. `users.org_id` retained for backwards compat. |
| 7 | **No resource-level isolation in B3** | Medium | Partial | Project-scoped URLs (`/projects/:id/*`) now check `requireProjectRole`. Non-scoped endpoints (`/labels/:id`, `/epics/:id`, etc.) still rely on scope/role only — cross-project access possible if UUID known. |
| 8 | ~~Banter channel role checks are inline~~ | ~~Low~~ | **Resolved** | Extracted into `requireChannelMember`/`requireChannelAdmin`/`requireChannelOwner` middleware. Applied to channel, pin, message routes. |
| 9 | ~~No impersonation support~~ | ~~Low~~ | **Resolved** | `X-Impersonate-User` header support in both auth plugins. SuperUser-only. All actions audit-logged. |
| 10 | ~~No permission change audit~~ | ~~Low~~ | **Resolved** | SuperUser actions logged to `superuser_audit_log`. Banter admin actions logged to `banter_audit_log`. |
| 11 | **UI permission mismatch (P2-3)** | Low | Open | Frontend surfaces actions (buttons, menu items) that the API rejects for viewers/guests. Server-side enforcement is correct; UI should hide/disable actions based on the caller's role to avoid 403s after click. |
| 12 | **UI permission mismatch (P2-4)** | Low | Open | Banter channel admin/owner-only controls (e.g. archive, rename, member management) are visible to regular channel members. API blocks the mutation, but the UI should gate these controls on `channelMembership.role` / org role. |

---

## 10. Implementation Status

### Phase 1: SuperUser + API Key Enforcement + Viewer — COMPLETE
- [x] `is_superuser` column on `users` table
- [x] `requireSuperUser` middleware in both B3 and Banter APIs
- [x] `requireMinRole(role)` middleware with hierarchy: owner > admin > member > viewer
- [x] `requireScope(scope)` middleware with hierarchy: admin > read_write > read
- [x] SuperUsers bypass all role and scope checks
- [x] Session auth bypasses scope checks (scope only applies to API keys)
- [x] SuperUser CLI flag (`--superuser`) on `create-admin` command
- [x] `superuser_audit_log` table with IP tracking
- [x] Platform admin routes: CRUD orgs, list org members, toggle SuperUser status, audit log
- [x] All POST/PATCH/DELETE endpoints guarded with `requireMinRole('member')` — viewers are read-only
- [x] All write endpoints guarded with `requireScope('read_write')` — read-only API keys blocked
- [x] All admin endpoints guarded with `requireScope('admin')` — non-admin API keys blocked
- [x] MCP server surfaces user-friendly scope error messages for 403 responses
- [x] `requireOrgRole` and `requireProjectRole` bypass for SuperUsers

### Phase 2: Guest Role — COMPLETE
- [x] `guest_invitations` table with token-based accept flow
- [x] Guest invitation API: invite, list, revoke, accept, update scope, remove guest
- [x] Guests auto-provisioned with `role='guest'` on acceptance
- [x] Auto-added to specified projects (as member) and channels on accept
- [x] Guest visibility restrictions on `GET /org/members` (only see members sharing a project)
- [x] Invitation expiry support
- [ ] Guest-specific frontend UI restrictions (deferred — UI stubs needed)

### Phase 3: Resource Isolation — COMPLETE
- [x] All 9 remaining B3 route files guarded with project-role + viewer + scope checks
- [x] Centralized Banter channel permission middleware (`requireChannelMember`, `requireChannelAdmin`, `requireChannelOwner`)
- [x] `organization_memberships` table with unique constraint + migration script
- [x] Auth plugins read active org context from `X-Org-Id` header or default membership
- [x] `GET /auth/orgs` and `POST /auth/switch-org` endpoints for org switching
- [ ] Frontend org switcher UI (deferred — backend ready)

### Phase 4: Fine-Grained Permissions — IN PROGRESS
- [x] Org permission settings service (`getOrgPermissions`, `checkOrgPermission`)
- [x] Permission toggles: `members_can_create_projects`, `members_can_create_channels`, `members_can_create_api_keys`, etc.
- [x] Enforcement in project, channel, and api-key creation routes
- [x] SuperUser impersonation support (X-Impersonate-User header, audit logged)
- [ ] Admin UI for editing permission toggles (some added to settings page)
- [ ] Per-project permission overrides
- [ ] Field-level permissions for sensitive data
- [ ] Permission templates / presets
