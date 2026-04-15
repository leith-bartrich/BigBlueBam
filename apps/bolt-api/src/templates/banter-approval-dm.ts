// ---------------------------------------------------------------------------
// Banter approval DM template
// ---------------------------------------------------------------------------
//
// Wave 3.2 deliverable: a reusable Bolt automation template that sends a
// Banter DM to an approver whenever an approval is requested. This template
// replaces the original design's bespoke "approval DM" flow in banter-api
// with a Bolt-driven automation that anyone can clone and customize from
// the Bolt template gallery.
//
// DEFERRAL NOTE: the trigger event 'approval.requested' is NOT yet registered
// in apps/bolt-api/src/services/event-catalog.ts. No subsystem currently
// emits it. The template is authored against that future contract so it
// becomes instantly useful the moment an approval-producing service (Brief
// publish-request flow, Bond deal-close sign-off, Bill invoice approval,
// etc.) starts calling:
//
//   publishBoltEvent('approval.requested', '<source-app>', {
//     approval_id, subject_id, subject_type, approver: { id, name, email },
//     body, url
//   }, orgId, requesterId, 'user');
//
// Until then, this template is registered but its trigger_event will NOT
// match any live events, and the Bolt drift guard (Bolt_Plan.md G4) will
// flag it until 'approval.requested' is added to the catalog. This is
// deliberate: it forces the cross-product owner of the approval workflow
// to register the event when they ship the emitter, rather than creating
// a placeholder catalog entry with no real producer.
//
// Parameter templating uses the same `{{ event.<field> }}` style as the
// other templates in template.service.ts. The two fields consumed are:
//   - {{ event.approver.id }}  -> banter_send_dm user_id
//   - {{ event.body }}         -> banter_send_dm content

import type { AutomationTemplate } from '../services/template.service.js';

export const banterApprovalDmTemplate: AutomationTemplate = {
  id: 'tpl_banter_approval_dm',
  name: 'Send approval request DM',
  description:
    'When an approval is requested, send a Banter DM to the approver with the approval details. Works for any subsystem that emits approval.requested events (Brief publish-requests, Bond deal sign-offs, Bill invoice approvals, etc.).',
  category: 'notifications',
  // NOTE: 'approval.requested' is a placeholder trigger; see header comment.
  // Once a producer registers it in event-catalog.ts (wave1bEvents append),
  // this template will start matching live events without further edits.
  trigger_source: 'platform',
  trigger_event: 'approval.requested',
  conditions: [
    {
      sort_order: 0,
      field: 'event.approver.id',
      operator: 'is_not_empty',
      value: null,
      logic_group: 'and',
    },
  ],
  actions: [
    {
      sort_order: 0,
      mcp_tool: 'banter_send_dm',
      parameters: {
        user_id: '{{ event.approver.id }}',
        content: '{{ event.body }}',
      },
      on_error: 'continue',
    },
  ],
};
