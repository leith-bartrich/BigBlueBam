# Bolt - Workflow Automation

Bolt is BigBlueBam's workflow automation engine for building event-driven rules that connect actions across all BigBlueBam apps without writing code.

## Key Features

- **Visual Rule Builder** with a node-graph editor for defining trigger, condition, and action chains
- **Event Catalog** covering events from Bam (task state changes), Bond (deal stage moves), Blast (email opens), and more
- **Execution Log** with detailed per-step traces showing inputs, outputs, timing, and error details
- **Template Browser** with pre-built automation patterns for common workflows (e.g., "notify channel when deal closes")
- **Conditional Logic** with branching, filters, and variable interpolation between steps

## Integrations

Bolt is the integration hub of BigBlueBam. It listens to events from every app (Bam, Bond, Blast, Bearing, Brief, Board, Banter, and others) and can perform actions across them: creating tasks, posting messages, updating deal fields, sending emails, and more. The event-driven architecture means automations fire in near real-time.

## Getting Started

Open Bolt from the Launchpad. Browse templates for inspiration or start a new automation from scratch. Pick a trigger event, add conditions to filter which events should proceed, then chain action nodes for what should happen. Test your automation, then activate it. Monitor executions in the execution log.
