# blank MCP Tools


| Tool | Description | Parameters |
|------|-------------|------------|
| `blank_create_form` | Create a new form with optional inline field definitions. | `slug`, `form_type`, `fields`, `field_key`, `label`, `field_type`, `required`, `options`, `scale_min`, `scale_max`, `scale_min_label`, `scale_max_label` |
| `blank_export_submissions` | Export all submissions for a form as CSV data. | `form_id` |
| `blank_generate_form` | AI generates a form from a natural-language description. Returns a form specification that can be passed to blank_create_form. | none |
| `blank_get_form` | Get a form definition with all its fields. | `id` |
| `blank_get_form_analytics` | Get response aggregation data for a form, including per-field breakdowns, submission trends, and summary statistics. | `form_id` |
| `blank_get_submission` | Get a specific submission with all response data. | `id` |
| `blank_list_forms` | List available forms for the current organization. Supports filtering by status and project. | `status`, `project_id` |
| `blank_list_submissions` | List submissions for a form. Returns paginated results. | `form_id`, `cursor`, `limit` |
| `blank_publish_form` | Publish a draft form, making it available for submissions. | `id` |
| `blank_summarize_responses` | Get analytics data for a form including response counts, field breakdowns, and trends. Useful for AI summarization of form results. | `form_id` |
| `blank_update_form` | Update form metadata or settings. | `id`, `form_type`, `accept_responses`, `theme_color` |
