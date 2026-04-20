import {
  ClipboardList,
  ArrowRight,
  Globe,
  GitBranch,
  BarChart3,
  Bot,
} from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { AnimatedReveal } from '@/components/ui/animated-reveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    icon: ClipboardList,
    title: 'Form Builder',
    description:
      'Drag-and-drop builder with text, number, date, select, file upload, rating, and matrix field types.',
    color: 'bg-violet-100 text-violet-600',
  },
  {
    icon: Globe,
    title: 'Public Forms',
    description:
      'Share forms via link or embed. Public submissions flow into your workspace without requiring authentication.',
    color: 'bg-purple-100 text-purple-600',
  },
  {
    icon: GitBranch,
    title: 'Conditional Logic',
    description:
      'Show, hide, or skip fields and pages based on previous answers for dynamic, personalized experiences.',
    color: 'bg-fuchsia-100 text-fuchsia-600',
  },
  {
    icon: BarChart3,
    title: 'Response Analytics',
    description:
      'Real-time response charts, completion funnels, and CSV export for every form and survey you create.',
    color: 'bg-violet-100 text-violet-600',
  },
  {
    icon: Bot,
    title: 'AI Form Operations',
    description:
      '11 MCP tools let AI agents generate form definitions from a prompt, publish forms, list and export submissions, pull per-form analytics, and summarize free-text responses.',
    color: 'bg-purple-100 text-purple-600',
  },
];

export function BlankSection() {
  return (
    <SectionWrapper id="blank" dividerTop>
      <AnimatedReveal>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge variant="purple" className="mb-4">
            Forms
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Collect anything
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Build forms and surveys with a visual editor, share them publicly or internally, add
            conditional logic for dynamic flows, and analyze responses with built-in charts and
            exports. Blank connects to Bolt automations for post-submission workflows.
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
        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-gradient-to-r from-violet-50 to-purple-50 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-violet-600" />
            <p className="text-sm font-medium text-zinc-700">
              Served at{' '}
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs">/blank/</code> — a
              dedicated SPA sharing authentication and the workspace model with Bam and Beacon.
            </p>
          </div>
          <Button href="/blank/" variant="primary" size="sm">
            Try Blank <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </AnimatedReveal>
    </SectionWrapper>
  );
}
