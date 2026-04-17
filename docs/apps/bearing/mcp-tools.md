# bearing MCP Tools


| Tool | Description | Parameters |
|------|-------------|------------|
| `bearing_at_risk` | Quick check: list all at-risk or behind goals across the organization. | none |
| `bearing_goal_create` | Create a new OKR goal within a period.  | `period_id`, `title`, `scope`, `project_id`, `team_name`, `icon`, `color`, `owner_id` |
| `bearing_goal_get` | Get a single goal with its key results and progress details. | `id` |
| `bearing_goal_update` | Update an existing goal. Provide only the fields to change.  | `id`, `title`, `scope`, `owner_id`, `icon`, `color` |
| `bearing_goals` | List OKR goals with optional filters by period, scope, owner, and status. | `period_id`, `scope`, `owner_id`, `status`, `limit` |
| `bearing_kr_create` | Create a key result under a goal.  | `goal_id`, `title`, `metric_type`, `target_value`, `start_value`, `unit`, `direction`, `progress_mode`, `owner_id` |
| `bearing_kr_link` | Link a key result to a Bam entity (epic, project, or task query) for automatic progress tracking.  | `key_result_id`, `link_type`, `target_type`, `target_id`, `metadata` |
| `bearing_kr_update` | Update a key result value or metadata. When current_value is provided, also records a value check-in.  | `id`, `current_value`, `title`, `target_value` |
| `bearing_period_get` | Get a single OKR period with aggregated stats. | `id` |
| `bearing_periods` | List OKR periods with optional filters by status and year. | `status`, `year` |
| `bearing_report` | Generate a period summary, at-risk, or owner report. | `report_type`, `period_id`, `user_id`, `format` |
| `bearing_update_post` | Post a status update on a goal.  | `goal_id`, `status`, `body` |
