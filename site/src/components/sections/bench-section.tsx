import {
  BarChart3,
  ArrowRight,
  LayoutDashboard,
  PieChart,
  Search,
  Clock,
  Database,
  Bot,
} from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { AnimatedReveal } from '@/components/ui/animated-reveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard Builder',
    description:
      'Drag-and-drop canvas editor with resizable widgets, auto-layout, and shareable dashboard links.',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    icon: PieChart,
    title: 'Widget Library',
    description:
      'Charts, tables, KPI cards, and gauges fed by cross-product data sources with configurable refresh intervals.',
    color: 'bg-sky-100 text-sky-600',
  },
  {
    icon: Search,
    title: 'Ad-hoc Explorer',
    description:
      'Write queries against your data, visualize results instantly, and save useful explorations as dashboard widgets.',
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    icon: Clock,
    title: 'Scheduled Reports',
    description:
      'Automatic PDF or CSV report generation on a cron schedule, delivered via email or Banter message.',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    icon: Database,
    title: 'Materialized Views',
    description:
      'Pre-computed aggregations that refresh on schedule for fast dashboard loads, even on large datasets.',
    color: 'bg-sky-100 text-sky-600',
  },
  {
    icon: Bot,
    title: 'AI Analytics',
    description:
      '9 MCP tools let AI agents create dashboards, add widgets, run ad-hoc queries, and schedule reports.',
    color: 'bg-indigo-100 text-indigo-600',
  },
];

export function BenchSection() {
  return (
    <SectionWrapper id="bench" dividerTop>
      <AnimatedReveal>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge variant="blue" className="mb-4">
            Analytics
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Data-driven decisions
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Build custom dashboards with drag-and-drop widgets, explore data with an ad-hoc query
            runner, schedule recurring reports, and accelerate large datasets with materialized views.
            Bench provides 9 MCP tools for AI-powered analytics workflows.
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
        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-gradient-to-r from-blue-50 to-sky-50 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <p className="text-sm font-medium text-zinc-700">
              Served at{' '}
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs">/bench/</code> — a
              dedicated SPA with cross-product data access for unified analytics.
            </p>
          </div>
          <Button href="/bench/" variant="primary" size="sm">
            Try Bench <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </AnimatedReveal>
    </SectionWrapper>
  );
}
