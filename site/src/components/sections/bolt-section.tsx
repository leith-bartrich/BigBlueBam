import {
  Zap,
  ArrowRight,
  Workflow,
  Radio,
  Bot,
  ClipboardList,
} from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { FloatingFrame } from '@/components/ui/floating-frame';
import { AnimatedReveal } from '@/components/ui/animated-reveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function BoltSection() {
  return (
    <SectionWrapper id="bolt" dividerTop>
      <AnimatedReveal>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge variant="green" className="mb-4">
            New
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Automate everything, visually
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Define trigger-condition-action rules that span every product in the BigBlueBam suite.
            Rules compile down to MCP tool calls, execute with full audit trails, and can be authored
            by humans or AI agents alike. No code required — just wire up events, set conditions, and
            pick actions.
          </p>
        </div>
      </AnimatedReveal>

      {/* Automation list */}
      <AnimatedReveal delay={0.1} withScale>
        <FloatingFrame src="/screenshots/bolt-automations.png" alt="Bolt Automation Dashboard" />
        <p className="mt-3 text-center text-sm text-zinc-500">
          Automation dashboard — 12 active rules with trigger badges, enable toggles, and execution history
        </p>
      </AnimatedReveal>

      {/* Builder screenshots */}
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <AnimatedReveal delay={0.15} withScale>
          <FloatingFrame src="/screenshots/bolt-editor-existing.png" alt="Bolt Visual Builder — editing existing" />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Editing "Notify on Critical Task" — WHEN/IF/THEN flow with live event catalog
          </p>
        </AnimatedReveal>
        <AnimatedReveal delay={0.2} withScale>
          <FloatingFrame src="/screenshots/bolt-editor-new.png" alt="Bolt Visual Builder — new" />
          <p className="mt-3 text-center text-sm text-zinc-500">
            New automation — pick a trigger, add conditions, select actions from grouped menu
          </p>
        </AnimatedReveal>
      </div>

      {/* Templates + Executions */}
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <AnimatedReveal delay={0.25} withScale>
          <FloatingFrame src="/screenshots/bolt-templates.png" alt="Bolt Automation Templates" />
          <p className="mt-3 text-center text-sm text-zinc-500">
            10 pre-built templates — start from a proven pattern and customize
          </p>
        </AnimatedReveal>
        <AnimatedReveal delay={0.3} withScale>
          <FloatingFrame src="/screenshots/bolt-executions.png" alt="Bolt Execution Log" />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Execution log — every run traced with status, duration, and step detail
          </p>
        </AnimatedReveal>
      </div>

      {/* Feature highlights */}
      <AnimatedReveal delay={0.2}>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Workflow className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Visual Rule Builder</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Drag-and-drop trigger-condition-action editor with live preview, validation, and
              plain-English summaries of what each rule does.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <Radio className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Cross-Product Events</h3>
            <p className="mt-2 text-sm text-zinc-600">
              26 events across 6 sources — Bam, Banter, Beacon, Brief, Helpdesk, and Schedule.
              React to task moves, new messages, stale knowledge, ticket creation, and cron schedules.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">MCP-Native</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Every action compiles to MCP tool calls — same permissions model, same audit trail.
              AI agents can create and manage automations through 12 dedicated tools.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Execution Audit Log</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Every run is recorded with trigger context, condition evaluation results, action
              outcomes, and duration. Full transparency into what ran and why.
            </p>
          </div>
        </div>
      </AnimatedReveal>

      <AnimatedReveal delay={0.3}>
        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <Zap className="h-6 w-6 text-primary-600" />
            <p className="text-sm font-medium text-zinc-700">
              Served at{' '}
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs">/bolt/</code> — a
              dedicated SPA sharing authentication and the project model with Bam, Beacon, and Brief.
            </p>
          </div>
          <Button href="/bolt/" variant="primary" size="sm">
            Try Bolt <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </AnimatedReveal>
    </SectionWrapper>
  );
}
