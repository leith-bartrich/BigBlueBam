import {
  Target,
  ArrowRight,
  TrendingUp,
  CalendarRange,
  FolderKanban,
  AlertTriangle,
  BarChart3,
  Bot,
} from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { AnimatedReveal } from '@/components/ui/animated-reveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    icon: TrendingUp,
    title: 'Automatic Progress',
    description:
      'Key Results linked to Bam epics update their progress as tasks complete. No manual slider dragging.',
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    icon: CalendarRange,
    title: 'Time-Boxed Periods',
    description:
      'Organize goals by quarters, halves, or custom periods with automatic status tracking.',
    color: 'bg-purple-100 text-purple-600',
  },
  {
    icon: FolderKanban,
    title: 'Cross-Project Rollup',
    description:
      'A single goal can draw progress from multiple Bam projects for org-level visibility.',
    color: 'bg-violet-100 text-violet-600',
  },
  {
    icon: AlertTriangle,
    title: 'At-Risk Detection',
    description:
      'Goals automatically flagged when progress falls behind the expected pace.',
    color: 'bg-rose-100 text-rose-600',
  },
  {
    icon: BarChart3,
    title: 'Progress Charts',
    description:
      'Daily snapshots power progress-over-time charts showing actual vs. expected trajectories.',
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    icon: Bot,
    title: 'AI Reporting',
    description:
      '12 MCP tools let AI agents generate reports, flag risks, and post summaries to Banter.',
    color: 'bg-purple-100 text-purple-600',
  },
];

export function BearingSection() {
  return (
    <SectionWrapper id="bearing" dividerTop>
      <AnimatedReveal>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge variant="purple" className="mb-4">
            Goals &amp; OKRs
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Strategy meets execution
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Connect quarterly objectives to daily work. Bearing provides hierarchical time-boxed
            periods, measurable key results with automatic progress tracking from linked Bam tasks,
            and a status engine that auto-classifies goals as on-track, at-risk, behind, or achieved
            — giving leadership real-time visibility without manual updates.
          </p>
        </div>
      </AnimatedReveal>

      {/* Hero screenshot */}
      <AnimatedReveal delay={0.15}>
        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 shadow-lg">
          <img
            src="/screenshots/bearing-dashboard.png"
            alt="Bearing Goals Dashboard — dark mode"
            className="w-full"
            loading="lazy"
          />
        </div>
        <p className="mt-3 text-center text-sm text-zinc-500">
          Goals Dashboard — summary stats, scope filtering, and period management
        </p>
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

      {/* Detail screenshots */}
      <AnimatedReveal delay={0.25}>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-lg">
            <img
              src="/screenshots/bearing-goal-detail.png"
              alt="Goal Detail — key results with progress bars, status updates, watchers"
              className="w-full"
              loading="lazy"
            />
            <div className="bg-white px-4 py-3">
              <p className="text-sm text-zinc-600">
                Goal detail — key results with progress bars, status updates, watchers
              </p>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-lg">
            <img
              src="/screenshots/bearing-at-risk.png"
              alt="At Risk Goals — goals behind schedule that need attention"
              className="w-full"
              loading="lazy"
            />
            <div className="bg-white px-4 py-3">
              <p className="text-sm text-zinc-600">
                At Risk view — goals behind schedule that need attention
              </p>
            </div>
          </div>
        </div>
      </AnimatedReveal>

      <AnimatedReveal delay={0.3}>
        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <Target className="h-6 w-6 text-indigo-600" />
            <p className="text-sm font-medium text-zinc-700">
              Served at{' '}
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs">/bearing/</code> — a
              dedicated SPA sharing authentication and the project model with Bam, Beacon, Brief, Bolt, Board, and Bond.
            </p>
          </div>
          <Button href="/bearing/" variant="primary" size="sm">
            Try Bearing <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </AnimatedReveal>
    </SectionWrapper>
  );
}
