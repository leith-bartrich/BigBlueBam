---
title: "Bench (Analytics) Guide"
app: bench
generated: "2026-04-17T06:14:43.081Z"
---

# Bench (Analytics) Guide


# Bench - Analytics & Dashboards

Bench is BigBlueBam's analytics app for building custom dashboards, running ad-hoc queries, and scheduling reports across all your organization's data.

## Key Features

- **Dashboard Builder** with a drag-and-drop canvas for arranging widgets (charts, tables, metrics, and text)
- **Widget Wizard** that walks you through creating visualizations from your data sources
- **Ad-Hoc Explorer** for running SQL-like queries against your organization's data without leaving the browser
- **Scheduled Reports** that email dashboard snapshots on a recurring schedule
- **Saved Queries** for reusing common data explorations across the team

## Integrations

Bench queries span data from Bam (tasks, sprints), Bond (deals, contacts), Blast (campaign metrics), and other BigBlueBam apps. Dashboard widgets can embed Bearing goal progress or Bam velocity charts. Scheduled reports can be delivered via Banter channel notifications.

## Getting Started

Open Bench from the Launchpad. Create a new dashboard, then add widgets using the wizard. Each widget connects to a data source and renders as a chart, table, or single metric. Use the explorer for one-off queries, and save them for reuse.

## MCP Tools


# bench MCP Tools


| Tool | Description | Parameters |
|------|-------------|------------|
| `bench_compare_periods` | Compare metrics between two time periods. Returns values for both periods and the percentage change. | `data_source`, `entity`, `measure_field`, `measure_agg`, `period1_start`, `period1_end`, `period2_start`, `period2_end` |
| `bench_detect_anomalies` | Scan recent metrics for anomalies. Queries the specified data source and compares the most recent period against the previous period to detect significant deviations. | `data_source`, `entity`, `measure_field`, `measure_agg`, `days` |
| `bench_generate_report` | Trigger immediate generation and delivery of a scheduled report. | `report_id` |
| `bench_get_dashboard` | Get a dashboard with all its widget configurations and layout. | `id` |
| `bench_list_dashboards` | List available analytics dashboards for the current organization. Supports filtering by project and visibility. | `project_id`, `visibility` |
| `bench_list_data_sources` | List all available data sources and their schemas (measures, dimensions, filters). Use this to discover what data can be queried through Bench. | none |
| `bench_list_scheduled_reports` | List scheduled reports for the organization, with optional fuzzy search on name. Returns id, name, dashboard_id, dashboard_name, schedule (cron expression + timezone + enabled), recipients (delivery method/target/format), last_run_at, and next_run_at. | `search` |
| `bench_list_widgets` | List widgets across the organization, optionally scoped to a single dashboard. Widgets are normally only reachable by nesting inside bench_get_dashboard; this gives them direct addressability for resolver flows. Returns id, name, type, dashboard_id, dashboard_name, position, and query. | `dashboard_id` |
| `bench_query_ad_hoc` | Run a structured query against any registered data source. Returns rows, SQL, and duration. Use bench_list_data_sources to discover available sources and their schemas. | `data_source`, `entity`, `measures`, `field`, `agg`, `alias`, `dimensions`, `field`, `alias`, `filters`, `field`, `op`, `value`, `limit` |
| `bench_query_widget` | Execute a widget query and return the data results. Returns rows, the generated SQL, and execution time. | `widget_id` |
| `bench_summarize_dashboard` | Get all widget data from a dashboard for AI summarization. Returns the dashboard metadata and query results for each widget. | `dashboard_id` |

## Related Apps

- [Bearing (Goals & OKRs)](../bearing/guide.md)
- [Blank (Forms)](../blank/guide.md)
- [Bond (CRM)](../bond/guide.md)
