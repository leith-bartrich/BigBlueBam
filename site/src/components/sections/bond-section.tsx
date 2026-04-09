import {
  Handshake,
  ArrowRight,
  Users,
  Building2,
  TrendingUp,
  Search,
  CalendarClock,
  Bot,
} from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { AnimatedReveal } from '@/components/ui/animated-reveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    icon: Users,
    title: 'Contacts & Companies',
    description:
      'Full contact database with company hierarchy, custom fields, tags, and merge/duplicate detection.',
    color: 'bg-pink-100 text-pink-600',
  },
  {
    icon: TrendingUp,
    title: 'Pipeline Board',
    description:
      'Kanban-style deal board with configurable stages, drag-and-drop, and weighted pipeline value per stage.',
    color: 'bg-rose-100 text-rose-600',
  },
  {
    icon: CalendarClock,
    title: 'Activity Timeline',
    description:
      'Log calls, emails, meetings, notes, and tasks against contacts, companies, or deals.',
    color: 'bg-fuchsia-100 text-fuchsia-600',
  },
  {
    icon: Building2,
    title: 'Cross-Product Links',
    description:
      'Link deals to Bam projects, Helpdesk tickets, Beacon articles, and Brief documents.',
    color: 'bg-pink-100 text-pink-600',
  },
  {
    icon: Search,
    title: 'Smart Search',
    description:
      'Full-text and semantic search across contacts, companies, deals, and activity notes.',
    color: 'bg-rose-100 text-rose-600',
  },
  {
    icon: Bot,
    title: 'AI Pipeline Management',
    description:
      '19 MCP tools let AI agents manage contacts, advance deals, log activities, and generate pipeline reports.',
    color: 'bg-fuchsia-100 text-fuchsia-600',
  },
];

export function BondSection() {
  return (
    <SectionWrapper id="bond" dividerTop>
      <AnimatedReveal>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge variant="pink" className="mb-4">
            CRM
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Relationships, tracked
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            A visual deal pipeline that lives alongside your project board, helpdesk, and knowledge
            base. Bond tracks contacts, companies, and deals through configurable pipeline stages --
            with activity logging, cross-product links, and 19 MCP tools so AI agents can manage
            your CRM pipeline as naturally as they manage tasks.
          </p>
        </div>
      </AnimatedReveal>

      {/* Feature highlights */}
      <AnimatedReveal delay={0.2}>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-gradient-to-r from-pink-50 to-rose-50 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <Handshake className="h-6 w-6 text-pink-600" />
            <p className="text-sm font-medium text-zinc-700">
              Served at{' '}
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs">/bond/</code> — a
              dedicated SPA sharing authentication and the project model with Bam, Beacon, Brief, Bolt, Bearing, and Board.
            </p>
          </div>
          <Button href="/bond/" variant="primary" size="sm">
            Try Bond <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </AnimatedReveal>
    </SectionWrapper>
  );
}
