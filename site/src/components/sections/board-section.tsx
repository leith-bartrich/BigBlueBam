import {
  PenTool,
  ArrowRight,
  Maximize2,
  Users,
  StickyNote,
  Bot,
} from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { AnimatedReveal } from '@/components/ui/animated-reveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function BoardSection() {
  return (
    <SectionWrapper id="board" dividerTop>
      <AnimatedReveal>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge variant="green" className="mb-4">
            New
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Think together, visually
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            An infinite-canvas whiteboard for brainstorming, diagramming, and collaborative planning --
            with real-time multi-user editing, built-in audio conferencing, and a sticky-to-task pipeline
            that turns whiteboard ideas into tracked work on the Bam board. AI agents can read the canvas,
            add shapes, and analyze layouts through 14 dedicated MCP tools.
          </p>
        </div>
      </AnimatedReveal>

      {/* Hero screenshot */}
      <AnimatedReveal delay={0.1} withScale>
        <FloatingFrame src="/screenshots/board-list.png" alt="Board whiteboard grid" />
        <p className="mt-3 text-center text-sm text-zinc-500">
          8 active whiteboards — retrospectives, brainstorms, architecture diagrams, and design sprints
        </p>
      </AnimatedReveal>

      {/* Feature highlights */}
      <AnimatedReveal delay={0.2}>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600">
              <Maximize2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Infinite Canvas</h3>
            <p className="mt-2 text-sm text-zinc-600">
              tldraw-based zoomable canvas with shapes, sticky notes, freehand drawing, images, text,
              and multitouch support for pinch-to-zoom and two-finger pan.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Real-Time + Audio</h3>
            <p className="mt-2 text-sm text-zinc-600">
              CRDT-based multi-user collaboration with live cursors, presence indicators, and
              built-in LiveKit audio conferencing per room -- no tab-switching required.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <StickyNote className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Sticky-to-Task</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Convert sticky notes into Bam tasks with one click. Title, description, and color
              carry over. Embed tasks, Beacons, Briefs, and goals directly on the canvas.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">AI Canvas Reading</h3>
            <p className="mt-2 text-sm text-zinc-600">
              14 MCP tools let AI agents read canvas state, add and arrange shapes, analyze
              spatial layouts, upload assets, and run sticky-to-task pipelines programmatically.
            </p>
          </div>
        </div>
      </AnimatedReveal>

      <AnimatedReveal delay={0.3}>
        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <PenTool className="h-6 w-6 text-primary-600" />
            <p className="text-sm font-medium text-zinc-700">
              Served at{' '}
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs">/board/</code> — a
              dedicated SPA sharing authentication and the project model with Bam, Beacon, Brief, Bolt, and Bearing.
            </p>
          </div>
          <Button href="/board/" variant="primary" size="sm">
            Try Board <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </AnimatedReveal>
    </SectionWrapper>
  );
}
