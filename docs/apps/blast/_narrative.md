# Blast - Email Campaigns

Blast is BigBlueBam's email campaign manager for creating, sending, and analyzing bulk email communications with a visual template editor and audience segmentation.

## Key Features

- **Campaign Manager** with draft, scheduled, sent, and archived states plus A/B testing support
- **Visual Template Editor** for designing responsive HTML emails with drag-and-drop blocks
- **Segment Builder** that filters contacts by attributes, tags, activity, and custom conditions
- **Analytics Dashboard** with open rates, click-through rates, bounce rates, and unsubscribe tracking
- **Domain Settings** for configuring DKIM, SPF, and custom sending domains
- **SMTP Configuration** for bring-your-own email infrastructure

## Integrations

Blast pulls contact lists from Bond CRM for targeting. Campaign events (opens, clicks, unsubscribes) flow back to Bond activity timelines. Bolt automations can trigger on campaign events. Open pixel tracking and click redirects are served via dedicated short-path endpoints (/t/ and /unsub/).

## Getting Started

Open Blast from the Launchpad. Configure your SMTP settings and sending domain first. Then create a template using the visual editor, build a segment to target your audience, and create a campaign. Preview and test before scheduling or sending.
