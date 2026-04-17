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
