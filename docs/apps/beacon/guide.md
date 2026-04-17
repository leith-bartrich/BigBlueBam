---
title: "Beacon (Knowledge Base) Guide"
app: beacon
generated: "2026-04-17T06:14:42.925Z"
---

# Beacon (Knowledge Base) Guide


# Beacon - Knowledge Base

Beacon is BigBlueBam's knowledge base app for creating, organizing, and searching team documentation with a visual knowledge graph.

## Key Features

- **Article Editor** with rich text, code blocks, attachments, and version history
- **Knowledge Graph** that visualizes relationships between articles for exploratory navigation
- **Semantic Search** powered by vector embeddings (Qdrant) for finding content by meaning, not just keywords
- **Dashboard** with analytics on article views, search patterns, and content freshness
- **Access Policies** that control who can view and edit articles within the organization

## Integrations

Beacon articles can be embedded in Brief documents and referenced in Banter messages. Bolt automations can trigger when articles are published or updated. The search API is available to the MCP server, allowing AI agents to query the knowledge base for context.

## Getting Started

Open Beacon from the Launchpad. Create your first article using the rich text editor, tag it with relevant topics, and link it to related articles. Use the graph explorer to visualize how your knowledge connects. The search bar supports natural language queries.

## MCP Tools


# beacon MCP Tools


| Tool | Description | Parameters |
|------|-------------|------------|
| `beacon_challenge` | Flag a Beacon for review (challenge its accuracy or relevance). | `id`, `reason` |
| `beacon_create` | Create a new Beacon (Draft). Provide title, body_markdown, visibility, and optional project scope. | `title`, `summary`, `body_markdown`, `visibility`, `project_id` |
| `beacon_get` | Retrieve a single Beacon by ID or slug. | `id` |
| `beacon_graph_hubs` | Get the most-connected Beacons in scope (hub nodes for Knowledge Home). | `scope`, `project_id`, `top_k` |
| `beacon_graph_neighbors` | Get nodes and edges within N hops of a focal Beacon for graph exploration. | `beacon_id`, `hops`, `include_implicit`, `tag_affinity_threshold`, `status` |
| `beacon_graph_recent` | Get recently modified or verified Beacons. | `scope`, `project_id`, `days` |
| `beacon_link_create` | Create a typed link between two Beacons. | `id`, `target_id`, `link_type` |
| `beacon_link_remove` | Remove a link from a Beacon. | `id`, `link_id` |
| `beacon_list` | List Beacons with optional filters and pagination. | `status`, `project_id`, `tags`, `cursor`, `limit`, `sort` |
| `beacon_policy_get` | Get the effective Beacon governance policy for the current scope. | `project_id` |
| `beacon_policy_resolve` | Preview the resolved effective policy (merging org + project levels). | `project_id` |
| `beacon_policy_set` | Set or update the Beacon governance policy at a given scope level. | `project_id`, `verification_interval_days`, `grace_period_days`, `auto_archive`, `tag_affinity_threshold` |
| `beacon_publish` | Transition a Beacon from Draft to Active. | `id` |
| `beacon_query_delete` | Delete a saved query (owner only). | `id` |
| `beacon_query_get` | Retrieve a saved query by ID. | `id` |
| `beacon_query_list` | List saved queries (own + shared in scope). | `scope`, `project_id` |
| `beacon_query_save` | Save a named search query configuration for reuse. | `query_body`, `scope`, `project_id` |
| `beacon_restore` | Restore an Archived Beacon back to Active status. | `id` |
| `beacon_retire` | Retire (soft-delete) a Beacon. | `id` |
| `beacon_search` | Hybrid semantic + keyword + graph search across Beacons. | `query`, `filters`, `project_ids`, `tags`, `status`, `visibility_max`, `expires_after`, `options`, `include_graph_expansion`, `include_tag_expansion`, `include_fulltext_fallback`, `top_k`, `cursor` |
| `beacon_search_context` | Structured retrieval optimized for agent consumption — richer metadata, linked Beacons pre-fetched. | `query`, `filters`, `project_ids`, `tags`, `status`, `top_k` |
| `beacon_suggest` | Typeahead suggestions from the Beacon title/tag index. | `q`, `limit` |
| `beacon_tag_add` | Add one or more tags to a Beacon. | `id`, `tags` |
| `beacon_tag_remove` | Remove a tag from a Beacon. | `id`, `tag` |
| `beacon_tags_list` | List all tags in scope with usage counts. | `project_id`, `cursor`, `limit` |
| `beacon_update` | Update a Beacon (creates a new version). Provide only the fields to change. | `id`, `title`, `summary`, `body_markdown`, `visibility`, `change_note` |
| `beacon_verify` | Record a verification event on a Beacon (confirms content is still accurate). | `id`, `verification_type`, `outcome`, `confidence_score`, `notes` |
| `beacon_version_get` | Get a specific version of a Beacon. | `id`, `version` |
| `beacon_versions` | List the version history of a Beacon. | `id` |

## Related Apps

- [Brief (Documents)](../brief/guide.md)
