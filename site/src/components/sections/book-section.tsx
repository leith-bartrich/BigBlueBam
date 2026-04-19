import {
  Calendar,
  ArrowRight,
  Users,
  RefreshCw,
  Globe,
  Bot,
} from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { AnimatedReveal } from '@/components/ui/animated-reveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    icon: Calendar,
    title: 'Calendar Views',
    description:
      'Day, week, month, and agenda views with drag-to-reschedule, color-coded event types, and mini-map navigation.',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    icon: Users,
    title: 'Resource Booking',
    description:
      'Book meeting rooms, equipment, and team availability with conflict detection and approval workflows.',
    color: 'bg-sky-100 text-sky-600',
  },
  {
    icon: RefreshCw,
    title: 'Recurring Events',
    description:
      'Daily, weekly, monthly, or custom recurrence rules with exception handling and series editing.',
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    icon: Globe,
    title: 'Timezone Support',
    description:
      'Timezone-aware scheduling with automatic conversion, world clock overlay, and team availability heatmaps.',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    icon: Bot,
    title: 'AI Scheduling Operations',
    description:
      '11 MCP tools let AI agents create, update, cancel, and RSVP to events, and find meeting times across mixed human-plus-agent rosters where agents have unlimited virtual availability and humans carry their working hours.',
    color: 'bg-sky-100 text-sky-600',
  },
];

export function BookSection() {
  return (
    <SectionWrapper id="book" dividerTop>
      <AnimatedReveal>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge variant="blue" className="mb-4">
            Scheduling
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Time, organized
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            A full-featured calendar with event scheduling, resource booking, timezone-aware
            coordination, and recurring event support. Book integrates with every BigBlueBam product
            so deadlines, meetings, and milestones live in one place.
          </p>
        </div>
      </AnimatedReveal>

      {/* Feature highlights */}
      <AnimatedReveal delay={0.2}>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${feature.color}`}>
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-zinc-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </AnimatedReveal>

      <AnimatedReveal delay={0.3}>
        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-600" />
            <p className="text-sm font-medium text-zinc-700">
              Served at{' '}
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs">/book/</code> — a
              dedicated SPA sharing authentication and the calendar model with Bam, Banter, and Board.
            </p>
          </div>
          <Button href="/book/" variant="primary" size="sm">
            Try Book <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </AnimatedReveal>
    </SectionWrapper>
  );
}
