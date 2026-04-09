import {
  Mail,
  ArrowRight,
  Paintbrush,
  Filter,
  FlaskConical,
  Send,
  BarChart3,
  Bot,
} from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { AnimatedReveal } from '@/components/ui/animated-reveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    icon: Paintbrush,
    title: 'Template Builder',
    description:
      'Drag-and-drop email template editor with reusable blocks, brand colors, and responsive preview across devices.',
    color: 'bg-red-100 text-red-600',
  },
  {
    icon: Filter,
    title: 'Smart Segments',
    description:
      'Build dynamic audience segments based on contact fields, tags, engagement history, and cross-product activity.',
    color: 'bg-rose-100 text-rose-600',
  },
  {
    icon: FlaskConical,
    title: 'Template Variables',
    description:
      'Personalize with {{first_name}}, {{company}}, and custom merge fields. Live preview shows interpolated values as you build.',
    color: 'bg-pink-100 text-pink-600',
  },
  {
    icon: Send,
    title: 'Delivery & Tracking',
    description:
      'Open pixel, click redirect, bounce handling, and unsubscribe management with full deliverability monitoring.',
    color: 'bg-red-100 text-red-600',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description:
      'Real-time campaign metrics -- opens, clicks, bounces, unsubscribes -- with per-link click maps and engagement trends.',
    color: 'bg-rose-100 text-rose-600',
  },
  {
    icon: Bot,
    title: 'AI Campaign Management',
    description:
      '14 MCP tools let AI agents create campaigns, build segments, generate templates, schedule sends, and analyze results.',
    color: 'bg-pink-100 text-pink-600',
  },
];

export function BlastSection() {
  return (
    <SectionWrapper id="blast" dividerTop>
      <AnimatedReveal>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge variant="pink" className="mb-4">
            Email Campaigns
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Campaigns that convert
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Design email campaigns with a visual drag-and-drop block builder, target the right
            audience with smart segments, personalize with merge fields, and measure everything with
            real-time analytics. Blast includes 14 MCP tools so AI agents can orchestrate your
            entire email marketing workflow.
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
        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-gradient-to-r from-red-50 to-rose-50 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-red-600" />
            <p className="text-sm font-medium text-zinc-700">
              Served at{' '}
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs">/blast/</code> — a
              dedicated SPA sharing authentication and the contact model with Bond, Bam, and Beacon.
            </p>
          </div>
          <Button href="/blast/" variant="primary" size="sm">
            Try Blast <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </AnimatedReveal>
    </SectionWrapper>
  );
}
