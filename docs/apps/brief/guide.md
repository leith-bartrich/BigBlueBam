---
title: "Brief (Documents) Guide"
app: brief
generated: "2026-04-17T06:14:43.723Z"
---

# Brief (Documents) Guide


# Brief - Collaborative Documents

Brief is BigBlueBam's collaborative document editor for creating, sharing, and co-editing rich text documents with real-time multiplayer support.

## Key Features

- **Rich Text Editor** powered by Tiptap with headings, lists, tables, code blocks, images, and embeds
- **Real-Time Collaboration** with live cursors, presence indicators, and conflict-free editing via Yjs
- **Document Organization** with folders, starring, and search across all documents
- **Templates** for common document types like meeting notes, PRDs, and project briefs
- **Version History** for tracking changes and restoring previous versions
- **Beacon Embeds** that pull knowledge base articles inline into your documents

## Integrations

Brief documents link to Bam tasks for requirements and specifications. Beacon articles can be embedded inline. Bolt automations can trigger when documents are published. Document links render as rich preview cards in Banter messages. Semantic search via Qdrant lets the MCP server find documents by meaning.

## Getting Started

Open Brief from the Launchpad. Create a new document or start from a template. The editor supports slash commands (type /) for inserting blocks. Share documents with team members for real-time co-editing. Use folders to organize your document library and the search bar to find content quickly.

## MCP Tools


# brief MCP Tools


| Tool | Description | Parameters |
|------|-------------|------------|
| `brief_append_content` | Append Markdown content to the end of a Brief document. | `id`, `content` |
| `brief_archive` | Archive a Brief document (soft-delete). | `id` |
| `brief_comment_add` | Add a comment to a Brief document, optionally as a reply or anchored to specific text. | `document_id`, `body`, `parent_id`, `anchor_text` |
| `brief_comment_list` | List comments on a Brief document. | `document_id` |
| `brief_comment_resolve` | Toggle the resolved state of a comment. | `comment_id` |
| `brief_create` | Create a new Brief document. | `title`, `project_id`, `folder_id`, `template_id`, `content`, `visibility` |
| `brief_duplicate` | Duplicate a Brief document, optionally into a different project. | `id`, `project_id` |
| `brief_get` | Retrieve a single Brief document by ID or slug. | `id` |
| `brief_link_task` | Link a Brief document to a Bam task. | `document_id`, `task_id`, `link_type` |
| `brief_list` | List Brief documents with optional filters and pagination. | `project_id`, `folder_id`, `status`, `created_by`, `cursor`, `limit` |
| `brief_promote_to_beacon` | Graduate a Brief document to a Beacon knowledge article. | `id` |
| `brief_restore` | Restore an archived Brief document. | `id` |
| `brief_search` | Search Brief documents by keyword or semantic similarity. | `query`, `project_id`, `status`, `semantic`, `limit` |
| `brief_update` | Update Brief document metadata. Provide only the fields to change. | `id`, `title`, `status`, `visibility`, `folder_id`, `icon`, `pinned` |
| `brief_update_content` | Replace the entire content of a Brief document with new Markdown. | `id`, `content` |
| `brief_version_get` | Get a specific version of a Brief document. | `document_id`, `version_id` |
| `brief_version_restore` | Restore a Brief document to a specific previous version. | `document_id`, `version_id` |
| `brief_versions` | List the version history of a Brief document. | `document_id` |

## Related Apps

- [Bam (Project Management)](../bam/guide.md)
- [Banter (Team Messaging)](../banter/guide.md)
- [Beacon (Knowledge Base)](../beacon/guide.md)
- [Board (Visual Collaboration)](../board/guide.md)
- [Bolt (Workflow Automation)](../bolt/guide.md)
