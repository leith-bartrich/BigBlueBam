# board MCP Tools


| Tool | Description | Parameters |
|------|-------------|------------|
| `board_add_sticky` | Add a sticky note to a board.  | `board_id`, `text`, `x`, `y`, `color` |
| `board_add_text` | Add a text element to a board.  | `board_id`, `text`, `x`, `y` |
| `board_archive` | Archive a board (soft delete).  | `id` |
| `board_create` | Create a new visual collaboration board.  | `project_id`, `template_id`, `background`, `visibility` |
| `board_export` | Export a board as SVG or PNG.  | `id`, `format` |
| `board_get` | Get board metadata by ID. | `id` |
| `board_list` | List boards with optional filters and pagination. | `project_id`, `visibility`, `cursor`, `limit` |
| `board_promote_to_tasks` | Promote sticky notes to Bam tasks in a project.  | `board_id`, `element_ids`, `project_id`, `phase_id` |
| `board_read_elements` | Read all elements on a board. Returns structured data with positions, text, and types.  | `id` |
| `board_read_frames` | Read frames with their contained elements from a board. | `id` |
| `board_read_stickies` | Read only sticky note elements from a board. | `id` |
| `board_search` | Search across board element text content. | `query`, `project_id` |
| `board_summarize` | Get a board summary grouped by frames, including element counts and text content.  | `id` |
| `board_update` | Update board metadata. Provide only the fields to change.  | `id`, `background`, `visibility`, `locked`, `icon` |
