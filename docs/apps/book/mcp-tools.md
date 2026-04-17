# book MCP Tools


| Tool | Description | Parameters |
|------|-------------|------------|
| `book_cancel_event` | Cancel a calendar event (sets status to cancelled).  | `id` |
| `book_create_booking_page` | Create a public booking page (scheduling link). | `slug`, `title`, `duration_minutes` |
| `book_create_event` | Create a calendar event with optional attendees.  | `calendar_id`, `title`, `start_at`, `end_at`, `location`, `meeting_url`, `all_day`, `attendees`, `email`, `user_id` |
| `book_find_meeting_time` | AI-assisted: find optimal meeting times for a set of attendees. Returns up to 3 suggested slots. Each entry in  | `user_ids`, `duration_minutes`, `start_date`, `end_date` |
| `book_get_availability` | Get available time slots for a user in a date range.  | `user_id`, `start_date`, `end_date` |
| `book_get_team_availability` | Get available time slots for multiple users to find common free times. Each entry in  | `user_ids`, `start_date`, `end_date` |
| `book_get_timeline` | Get aggregated cross-product timeline with Book events, Bam tasks, sprints, and more. | `start_date`, `end_date` |
| `book_list_events` | List calendar events in a date range, optionally filtered by calendar IDs. | `start_after`, `start_before`, `calendar_ids`, `limit` |
| `book_rsvp_event` | Accept, decline, or mark tentative for a calendar event on behalf of the current user.  | `event_id`, `response_status` |
| `book_update_event` | Update an existing calendar event.  | `id`, `title`, `start_at`, `end_at`, `location`, `status` |
