import {
  BookOpen,
  ArrowRight,
  Clock,
  Search,
  Bot,
  GitFork,
} from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { FloatingFrame } from '@/components/ui/floating-frame';
import { AnimatedReveal } from '@/components/ui/animated-reveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function BeaconSection() {
  return (
    <SectionWrapper id="beacon" dividerTop>
      <AnimatedReveal>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge variant="green" className="mb-4">
            New
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Knowledge that stays fresh
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            A curated knowledge base with expiry governance, semantic search, a Knowledge Graph
            Explorer, and agent-native verification. Every Beacon has a shelf life — stale
            knowledge gets surfaced, challenged, and renewed automatically.
          </p>
        </div>
      </AnimatedReveal>

      {/* Hero screenshots */}
      <div className="grid gap-8 lg:grid-cols-2">
        <AnimatedReveal delay={0.1} withScale>
          <FloatingFrame src="/screenshots/beacon-home.png" alt="Beacon Knowledge Home" />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Knowledge Home — stats, recent activity, and quick-action cards
          </p>
        </AnimatedReveal>
        <AnimatedReveal delay={0.15} withScale>
          <FloatingFrame src="/screenshots/beacon-list.png" alt="Beacon browse list" />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Browse beacons by status, project, and tags with infinite scroll
          </p>
        </AnimatedReveal>
      </div>

      {/* Feature highlights */}
      <AnimatedReveal delay={0.2}>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Expiry-aware</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Every Beacon has a shelf life. Stale knowledge is surfaced on the governance
              dashboard before it misleads your team.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Semantic + graph search</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Find knowledge by meaning, not just keywords. The hybrid search pipeline expands
              queries through tag affinity and link traversal.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Agent verification</h3>
            <p className="mt-2 text-sm text-zinc-600">
              AI agents verify and challenge Beacons within confidence bounds. Freshness scores
              track how much of your knowledge base stays current.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <GitFork className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Knowledge Graph</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Explore connections between your team's knowledge. Explicit links and implicit tag
              affinities form a navigable graph of related Beacons.
            </p>
          </div>
        </div>
      </AnimatedReveal>

      {/* Graph + Dashboard screenshots */}
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <AnimatedReveal delay={0.25} withScale>
          <FloatingFrame
            src="/screenshots/beacon-graph.png"
            alt="Knowledge Graph explorer showing connected Beacons"
          />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Knowledge Graph — visualize how Beacons connect through links and shared tags
          </p>
        </AnimatedReveal>
        <AnimatedReveal delay={0.3} withScale>
          <FloatingFrame
            src="/screenshots/beacon-dashboard.png"
            alt="Governance dashboard with freshness score and at-risk beacons"
          />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Governance dashboard — freshness score, at-risk beacons, and agent activity
          </p>
        </AnimatedReveal>
      </div>

      <AnimatedReveal delay={0.35}>
        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 text-primary-600" />
            <p className="text-sm font-medium text-zinc-700">
              Served at{' '}
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs">/beacon/</code> — a
              dedicated SPA sharing authentication and the project model with Bam.
            </p>
          </div>
          <Button href="/beacon/" variant="primary" size="sm">
            Try Beacon <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </AnimatedReveal>
    </SectionWrapper>
  );
}
