import { Headset, ArrowRight, Ticket, Bot, ArrowRightLeft } from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { FloatingFrame } from '@/components/ui/floating-frame';
import { AnimatedReveal } from '@/components/ui/animated-reveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function HelpdeskSection() {
  return (
    <SectionWrapper id="helpdesk" dividerTop>
      <AnimatedReveal>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge variant="green" className="mb-4">
            Included
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Customer-facing helpdesk
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            A separate portal where customers submit and track support tickets. Every ticket
            auto-creates a linked task on your board — and AI agents can triage, respond, and
            resolve without human intervention.
          </p>
        </div>
      </AnimatedReveal>

      {/* Portal screenshots */}
      <div className="grid gap-8 lg:grid-cols-2">
        <AnimatedReveal delay={0.1} withScale>
          <FloatingFrame src="/screenshots/helpdesk-login.png" alt="Helpdesk login portal" />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Clean, branded portal — separate from your internal tools
          </p>
        </AnimatedReveal>
        <AnimatedReveal delay={0.15} withScale>
          <FloatingFrame src="/screenshots/helpdesk-tickets.png" alt="Helpdesk ticket list" />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Customers track ticket status with real-time updates
          </p>
        </AnimatedReveal>
      </div>

      {/* Ticket-to-task pipeline */}
      <AnimatedReveal delay={0.2}>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="relative rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="absolute -top-3 left-6 flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">
              1
            </div>
            <Ticket className="mb-3 h-5 w-5 text-primary-600" />
            <h3 className="text-base font-semibold text-zinc-900">Customer submits ticket</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Client reports an issue through the helpdesk portal with category, priority, and description.
            </p>
          </div>
          <div className="relative rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="absolute -top-3 left-6 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
              2
            </div>
            <Bot className="mb-3 h-5 w-5 text-amber-600" />
            <h3 className="text-base font-semibold text-zinc-900">AI agent triages</h3>
            <p className="mt-2 text-sm text-zinc-600">
              A task is auto-created on the board. An AI agent sets priority, checks for similar
              open tickets via the dedupe primitives, upserts the requester by email, and
              responds to the customer.
            </p>
          </div>
          <div className="relative rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="absolute -top-3 left-6 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
              3
            </div>
            <ArrowRightLeft className="mb-3 h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-zinc-900">Board syncs ticket</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Moving the task through board phases automatically updates the ticket status. Clients
              see progress without your team lifting a finger.
            </p>
          </div>
        </div>
      </AnimatedReveal>

      {/* Conversation screenshots */}
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <AnimatedReveal delay={0.25} withScale>
          <FloatingFrame
            src="/screenshots/helpdesk-conversation.png"
            alt="Helpdesk ticket detail with description and metadata"
          />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Ticket detail with full description and metadata
          </p>
        </AnimatedReveal>
        <AnimatedReveal delay={0.3} withScale>
          <FloatingFrame
            src="/screenshots/helpdesk-detail-conversation.png"
            alt="Client and agent conversation thread"
          />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Threaded conversations — agent replies visible to clients, internal notes stay private
          </p>
        </AnimatedReveal>
      </div>

      <AnimatedReveal delay={0.35}>
        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <Headset className="h-6 w-6 text-primary-600" />
            <p className="text-sm font-medium text-zinc-700">
              Separate SPA served at{' '}
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs">/helpdesk/</code> — customers
              never see your internal project board.
            </p>
          </div>
          <Button href="/helpdesk/" variant="primary" size="sm">
            Try Helpdesk <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </AnimatedReveal>
    </SectionWrapper>
  );
}
