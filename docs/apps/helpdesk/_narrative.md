# Helpdesk - Support Portal

Helpdesk is BigBlueBam's customer-facing support portal where end users submit and track support tickets, and agents manage conversations through to resolution.

## Key Features

- **Ticket Submission** with categories, priority levels, file attachments, and rich text descriptions
- **Conversation Threading** with back-and-forth messaging between the submitter and support agents
- **Multi-Tenant Routing** with path-based org and project scoping (/helpdesk/org-slug/project-slug/)
- **Email Verification** for new users submitting tickets without a BigBlueBam account
- **Browser Notifications** for real-time updates when agents respond to tickets
- **Offline Support** with mutation retry and an offline banner for unreliable connections

## Integrations

Helpdesk tickets appear in the Bam agent queue for internal teams using the main project management app. Bolt automations can trigger on ticket status changes. The Helpdesk API shares the BigBlueBam authentication system so agents use their existing credentials.

## Getting Started

End users navigate to the Helpdesk URL for their organization (e.g., /helpdesk/your-org/). From there they can create an account or log in, then submit a ticket describing their issue. Agents see incoming tickets in the queue and respond through the conversation thread. Ticket status flows from open through in-progress to resolved.
