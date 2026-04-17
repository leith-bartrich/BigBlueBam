---
title: "Banter (Team Messaging) Guide"
app: banter
generated: "2026-04-17T06:14:42.877Z"
---

# Banter (Team Messaging) Guide


# Banter - Team Messaging

Banter is BigBlueBam's real-time team messaging app with channels, direct messages, threads, file sharing, and voice calls.

## Key Features

- **Channels** for organized team conversations with topics, pinned messages, and bookmarks
- **Threaded Replies** that keep discussions contextual without cluttering the main channel
- **Direct Messages** for private one-on-one or small group conversations
- **Rich Text** with markdown support, emoji reactions, link previews, and file attachments
- **Voice Calls** with call recording and playback for asynchronous review

## Integrations

Banter connects to every other BigBlueBam app through cross-product embeds. Paste a task URL from Bam or a document link from Brief and it renders an inline preview card. Bolt automations can post messages to channels when events fire. Keyboard shortcut Ctrl+K opens the quick channel switcher.

## Getting Started

Navigate to Banter from the Launchpad. You land in the #general channel by default. Browse available channels, create new ones for your team or project, and start conversations. Use threaded replies for focused discussions. Press ? for this help page at any time.

## MCP Tools


# banter MCP Tools


| Tool | Description | Parameters |
|------|-------------|------------|
| `banter_add_channel_members` | Add one or more members to a Banter channel. Accepts a channel UUID, name, or #name, and each user may be a UUID, email, or @handle — mixed lists are supported. | `channel_id`, `user_ids` |
| `banter_add_group_members` | Add members to a user group | `group_id`, `user_ids` |
| `banter_archive_channel` | Archive a Banter channel (reversible). Accepts a channel UUID, a bare channel name, or #name — no need to resolve the id first. | `channel_id` |
| `banter_browse_channels` | Browse available Banter channels (including unjoined public channels) | `q`, `cursor`, `limit` |
| `banter_create_channel` | Create a new Banter channel | `topic`, `is_private`, `group_id` |
| `banter_create_user_group` | Create a new user group (e.g. @backend-team) | `handle`, `user_ids` |
| `banter_delete_channel` | Delete a Banter channel (destructive - requires confirmation) | `channel_id`, `confirm_action` |
| `banter_delete_message` | Delete a Banter message (destructive - requires confirmation) | `message_id`, `confirm` |
| `banter_edit_message` | Edit an existing Banter message | `message_id`, `content` |
| `banter_end_call` | End an active call (destructive - requires confirmation) | `call_id`, `confirm` |
| `banter_find_user_by_email` | Find a Banter user by email (case-insensitive exact match). Returns {id, email, name, display_name, avatar_url} or null if no match. | `email` |
| `banter_find_user_by_handle` | Find a Banter user by handle (accepts  | `handle` |
| `banter_get_active_huddle` | Check if a channel has an active huddle and get its details | `channel_id` |
| `banter_get_call` | Get details about a specific call | `call_id` |
| `banter_get_channel` | Get detailed information about a Banter channel | `channel_id` |
| `banter_get_channel_by_name` | Resolve a Banter channel by name or handle. Accepts  | `name_or_handle` |
| `banter_get_message` | Get a specific Banter message by ID | `message_id` |
| `banter_get_preferences` | Get the authenticated user\ | none |
| `banter_get_transcript` | Get the transcript for a call | `call_id` |
| `banter_get_unread` | Get the current user\ | none |
| `banter_get_user_group_by_handle` | Resolve a Banter user group by handle (accepts  | `handle` |
| `banter_invite_agent_to_call` | Invite an AI agent to join an active call as a participant | `call_id`, `agent_id` |
| `banter_join_call` | Join an active call | `call_id` |
| `banter_join_channel` | Join a Banter channel. Accepts a channel UUID, a bare channel name, or #name. | `channel_id` |
| `banter_leave_call` | Leave an active call | `call_id` |
| `banter_leave_channel` | Leave a Banter channel | `channel_id` |
| `banter_list_calls` | List calls in a Banter channel (active and recent) | `channel_id`, `status`, `cursor`, `limit` |
| `banter_list_channels` | List all Banter channels the current user has access to | `cursor`, `limit` |
| `banter_list_messages` | List messages in a Banter channel with pagination | `channel_id`, `cursor`, `limit`, `direction` |
| `banter_list_thread_replies` | List replies in a Banter message thread | `message_id`, `cursor`, `limit` |
| `banter_list_user_groups` | List all user groups in the organization | `cursor`, `limit` |
| `banter_list_users` | Fuzzy search Banter users by name, display name, or email. Returns up to 20 users in the active org ordered by relevance. If no query is supplied, returns the 20 most recently created users. | `query` |
| `banter_pin_message` | Pin a message in a Banter channel. Accepts a channel UUID, name, or #name. | `channel_id`, `message_id` |
| `banter_post_call_text` | Post a text message in a call channel with a call reference (for text-mode AI participation) | `channel_id`, `call_id`, `content` |
| `banter_post_message` | Post a new message to a Banter channel. Accepts a channel UUID, a bare channel name, or #name — the common Bolt automation pattern  | `channel_id`, `content`, `attachment_ids` |
| `banter_react` | Add or remove an emoji reaction on a Banter message | `message_id`, `emoji` |
| `banter_remove_channel_member` | Remove a member from a Banter channel | `channel_id`, `user_id` |
| `banter_remove_group_member` | Remove a member from a user group | `group_id`, `user_id` |
| `banter_reply_to_thread` | Post a reply in a Banter message thread | `message_id`, `content`, `also_send_to_channel` |
| `banter_search_messages` | Search messages across Banter channels | `q`, `channel_id`, `from_user_id`, `before`, `after`, `cursor`, `limit` |
| `banter_search_transcripts` | Search call transcripts across Banter (placeholder - returns available transcripts) | `q`, `channel_id`, `cursor`, `limit` |
| `banter_send_dm` | Send a direct message to another user (creates or reuses existing DM channel). Accepts a user UUID, email address, or @handle. | `to_user_id`, `content` |
| `banter_send_group_dm` | Send a group direct message (creates or reuses existing group DM). Each recipient may be a UUID, email, or @handle — mixed lists are supported. | `user_ids`, `content` |
| `banter_set_presence` | Set the authenticated user\ | `status`, `status_text`, `status_emoji` |
| `banter_share_sprint` | Share a BigBlueBam sprint summary as a rich embed in a Banter channel. Accepts a channel UUID, name, or #name. | `channel_id`, `sprint_id`, `comment` |
| `banter_share_task` | Share a BigBlueBam task as a rich embed in a Banter channel. Accepts a channel UUID, name, or #name. | `channel_id`, `task_id`, `comment` |
| `banter_share_ticket` | Share a Helpdesk ticket as a rich embed in a Banter channel. Accepts a channel UUID, name, or #name. | `channel_id`, `ticket_id`, `comment` |
| `banter_start_call` | Start a new voice/video call in a Banter channel. Accepts a channel UUID, name, or #name. | `channel_id`, `type` |
| `banter_unpin_message` | Unpin a message from a Banter channel. Accepts a channel UUID, name, or #name. | `channel_id`, `message_id` |
| `banter_update_channel` | Update a Banter channel name, description, or topic | `channel_id`, `topic` |
| `banter_update_preferences` | Update the authenticated user\ | `preferences` |
| `banter_update_user_group` | Update a user group name, handle, or description | `group_id`, `handle` |

## Related Apps

- [Beacon (Knowledge Base)](../beacon/guide.md)
- [Bench (Analytics)](../bench/guide.md)
- [Board (Visual Collaboration)](../board/guide.md)
- [Bolt (Workflow Automation)](../bolt/guide.md)
- [Bond (CRM)](../bond/guide.md)
- [Brief (Documents)](../brief/guide.md)
