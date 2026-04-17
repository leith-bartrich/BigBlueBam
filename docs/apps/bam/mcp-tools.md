# bam MCP Tools


| Tool | Description | Parameters |
|------|-------------|------------|
| `add_comment` | Add a comment to a task. Accepts either a task UUID or human_id (e.g.  | `task_id`, `body` |
| `bam_find_user` | Fuzzy-search users by display name or email (scoped to the caller | `query` |
| `bam_find_user_by_email` | Find a user by their exact email address (case-insensitive, scoped to the caller | `email` |
| `bam_get_task_by_human_id` | Look up a task by its human-readable reference (e.g.  | `human_id` |
| `bam_list_epics` | List all epics for a project, with task counts and status. | `project_id` |
| `bam_list_labels` | List labels. If project_id is given, lists labels for that project; otherwise lists labels for every project the caller can see in their org. | `project_id` |
| `bam_list_phases` | List all phases (board columns) for a project, ordered by position | `project_id` |
| `bam_list_states` | List all task states for a project, ordered by position. Each state has a category in { todo, active, blocked, review, done, cancelled }. | `project_id` |
| `bulk_update_tasks` | Perform a bulk operation on multiple tasks at once. Each task_ids entry may be a UUID or a human_id (e.g. FRND-42). | `task_ids`, `operation`, `fields` |
| `change_my_password` | Change the authenticated user | `current_password`, `new_password` |
| `complete_sprint` | Complete an active sprint | `sprint_id`, `carry_forward`, `target_sprint_id`, `tasks`, `task_id`, `action`, `retrospective_notes` |
| `confirm_action` | Confirm a destructive action using a confirmation token. First call without a token to stage the action and receive a token. Then call again with the token to execute. | `action`, `resource_id`, `token` |
| `create_from_template` | Create a task from a template, optionally overriding specific fields. Accepts project name and template name in addition to UUIDs. | `project_id`, `template_id`, `overrides` |
| `create_project` | Create a new project | `task_id_prefix`, `slug`, `icon`, `color`, `template` |
| `create_sprint` | Create a new sprint for a project | `project_id`, `start_date`, `end_date`, `goal` |
| `create_task` | Create a new task in a project. Accepts natural identifiers (project name, phase name, sprint name, label name, user email) in addition to UUIDs. | `project_id`, `title`, `phase_id`, `sprint_id`, `assignee_id`, `priority`, `story_points`, `label_ids`, `epic_id`, `parent_task_id` |
| `delete_task` | Delete a task (destructive action - will ask for confirmation) | `task_id`, `confirm` |
| `disconnect_github_integration` | Remove the GitHub integration from a project. This is destructive — it deletes the webhook config and all linked commit/PR references. Requires project admin or org admin role. | `project_id`, `confirm` |
| `duplicate_task` | Duplicate an existing task, optionally including its subtasks | `task_id`, `include_subtasks` |
| `find_user_by_email` | Find a user by exact email address (case-insensitive) within the caller\ | `email` |
| `find_user_by_name` | Fuzzy-search active users by name or email within the caller\ | `query` |
| `get_burndown` | Get burndown chart data for a specific sprint | `sprint_id` |
| `get_cumulative_flow` | Get cumulative flow diagram data for a project over a date range | `project_id`, `from_date`, `to_date` |
| `get_cycle_time_report` | Get cycle time metrics (created_at → completed_at) for completed tasks in a project. | `project_id` |
| `get_me` | Get the authenticated user profile (display name, email, avatar, timezone, notification preferences, active org, superuser flag). | none |
| `get_my_tasks` | Get tasks assigned to the current authenticated user, optionally filtered by project | `project_id`, `state_category`, `sprint_id`, `cursor`, `limit` |
| `get_overdue_tasks` | Get a report of all overdue tasks in a project | `project_id` |
| `get_platform_settings` | SuperUser only. Fetch platform-wide settings (public signup toggle, etc). | none |
| `get_project` | Get detailed information about a specific project | `project_id` |
| `get_public_config` | SuperUser only (MCP gate). Read the unauthenticated /public/config — currently returns whether public signup is disabled. The underlying endpoint is public, but we gate MCP access to SuperUsers since this is part of the platform-admin surface. | none |
| `get_server_info` | Get information about this MCP server including version, available tools, authenticated user, and rate limit status | none |
| `get_sprint_report` | Get a sprint report with velocity, completion stats, and burndown data | `sprint_id` |
| `get_status_distribution` | Get status distribution report showing task counts per phase/status | `project_id` |
| `get_task` | Get detailed information about a specific task | `task_id` |
| `get_time_tracking_report` | Get aggregated time entries per user for a project, optionally bounded by a date range. | `project_id`, `from`, `to` |
| `get_velocity_report` | Get velocity report showing story points completed across recent sprints | `project_id`, `last_n_sprints` |
| `get_workload` | Get workload distribution report showing task counts and story points per team member | `project_id` |
| `import_csv` | Import tasks from CSV data into a project | `project_id`, `rows`, `mapping` |
| `import_github_issues` | Import GitHub issues into a project as tasks | `project_id`, `issues`, `number`, `title`, `body`, `state`, `labels`, `assignee` |
| `list_beta_signups` | SuperUser only. List notify-me submissions from the public beta-gate form, newest first. | none |
| `list_comments` | List all comments on a task | `task_id`, `cursor`, `limit` |
| `list_members` | List members of a project or the entire organization | `project_id`, `cursor`, `limit` |
| `list_my_notifications` | Fetch the caller | `cursor`, `limit`, `unread_only`, `category`, `source_app` |
| `list_my_orgs` | List organizations the authenticated user is a member of, including role in each. | none |
| `list_projects` | List all projects the current user has access to | `cursor`, `limit` |
| `list_sprints` | List all sprints for a project | `project_id`, `status` |
| `list_templates` | List available task templates for a project. Accepts project name or UUID. | `project_id` |
| `list_users` | List users in the caller\ | `active_only`, `limit` |
| `log_time` | Log time spent on a task | `task_id`, `minutes`, `date` |
| `logout` | Invalidate the current session cookie. Note: API-key callers are not affected — this only logs out cookie sessions. | none |
| `mark_all_notifications_read` | Mark every notification in the caller | none |
| `mark_notification_read` | Mark a single notification as read. | `notification_id` |
| `mark_notifications_read` | Mark several notifications as read in one call. | `notification_ids` |
| `move_task` | Move a task to a different phase and/or position on the board. Accepts natural identifiers for task and phase. | `task_id`, `phase_id`, `position`, `sprint_id` |
| `search_tasks` | Search and filter tasks in a project | `project_id`, `q`, `phase_id`, `sprint_id`, `assignee_id`, `priority`, `state_category`, `cursor`, `limit` |
| `set_public_signup_disabled` | SuperUser only. Toggle the platform-wide public signup kill switch. When true, POST /auth/register and POST /helpdesk/auth/register return 403 SIGNUP_DISABLED and the login pages | `public_signup_disabled` |
| `start_sprint` | Start a planned sprint | `sprint_id` |
| `submit_beta_signup` | SuperUser only (MCP gate). Create a notify-me submission via the public /public/beta-signup endpoint. The HTTP endpoint is public-by-anyone, but we only allow SuperUsers to invoke it through MCP (typically for testing or manual entry on behalf of a prospect). | `email`, `phone`, `message` |
| `suggest_branch_name` | Generate a git branch name suggestion based on a task. Fetches the task and returns a name like  | `task_id` |
| `switch_active_org` | Switch the active organization for the current session. Affects which projects/members/tickets are returned by downstream calls. | `org_id` |
| `test_slack_webhook` | Send a test message to the Slack webhook configured for a project. Requires project admin or org admin role. | `project_id` |
| `update_me` | Update the authenticated user | `display_name`, `avatar_url`, `timezone`, `notification_prefs` |
| `update_task` | Update an existing task. Accepts natural identifiers for task, assignee, state, and sprint in addition to UUIDs. | `task_id`, `title`, `assignee_id`, `priority`, `story_points`, `sprint_id`, `state_id`, `start_date`, `due_date` |
