# Bam - Project Management

Bam is the core project management app in BigBlueBam, providing Kanban boards with sprint-based task tracking for small-to-medium teams.

## Key Features

- **Kanban Board** with drag-and-drop task cards, configurable phases, and swimlane views (by assignee, priority, or label)
- **Sprint Management** with carry-forward mechanics that automatically track tasks rolling between sprints
- **Custom Fields** stored as JSONB per project, supporting text, number, select, date, and multi-select types
- **Multiple Views** including board, list, timeline, and calendar layouts with saved view presets
- **Rich Task Detail** with subtasks, comments (with reactions), time entries, attachments, activity log, and watchers

## Integrations

Bam shares authentication and organization context with every other BigBlueBam app. Tasks link to Brief documents, Bolt automations can trigger on task state changes, Bearing goals can reference project progress, and the command palette (Cmd+K) provides quick navigation across all apps via the Launchpad.

## Getting Started

After logging in, create your first project from the dashboard. Define your phases (columns) and task states, then start adding tasks to the board. Invite team members through the People page. Use keyboard shortcuts (press ? for this help page, Cmd+K for the command palette) to navigate quickly. Sprint reports and project dashboards give you visibility into velocity, burndown, and workload distribution.
