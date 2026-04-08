import {
  MessageCircle,
  Phone,
  Mic,
  Bot,
  Hash,
  AtSign,
  Search,
  Paperclip,
  Pin,
  Bookmark,
  Users,
  Eye,
  Link2,
  ArrowRight,
} from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { FloatingFrame } from '@/components/ui/floating-frame';
import { AnimatedReveal } from '@/components/ui/animated-reveal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const featureTable = [
  { label: 'Channels', status: 'Stable', icon: Hash },
  { label: 'Direct Messages', status: 'Stable', icon: MessageCircle },
  { label: 'Threads', status: 'Stable', icon: MessageCircle },
  { label: 'Rich Text', status: 'Stable', icon: AtSign },
  { label: 'Reactions', status: 'Stable', icon: MessageCircle },
  { label: 'Mentions', status: 'Stable', icon: AtSign },
  { label: 'Search', status: 'Stable', icon: Search },
  { label: 'File Sharing', status: 'Stable', icon: Paperclip },
  { label: 'Pins & Bookmarks', status: 'Stable', icon: Pin },
  { label: 'Presence', status: 'Stable', icon: Eye },
  { label: 'Bam Integration', status: 'Stable', icon: Link2 },
  { label: '44 MCP Tools', status: 'Stable', icon: Bot },
  { label: 'Voice Calls', status: 'Alpha', icon: Phone },
  { label: 'AI Voice Agent', status: 'Planned', icon: Mic },
];

export function BanterStub() {
  return (
    <SectionWrapper id="banter" alternate dividerTop>
      {/* Header */}
      <AnimatedReveal>
        <div className="mx-auto mb-6 max-w-3xl text-center">
          <Badge variant="orange" className="mb-4">
            Alpha
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Banter — team messaging, built in
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Real-time channels, DMs, threads, voice calls, and AI agent participation — all
            natively integrated with your project board, knowledge base, and helpdesk. No webhooks.
            No bridges. No sync lag.
          </p>
        </div>
      </AnimatedReveal>

      {/* Hero screenshot */}
      <AnimatedReveal delay={0.1} withScale>
        <FloatingFrame
          src="/screenshots/banter-channels.png"
          alt="Banter channel view with sidebar, messages, and member list"
        />
      </AnimatedReveal>

      {/* Why not Slack? */}
      <AnimatedReveal delay={0.15}>
        <div className="mt-10 rounded-xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-6 md:p-8">
          <h3 className="text-lg font-bold text-zinc-900">Why not just use Slack?</h3>
          <p className="mt-2 text-zinc-600">
            Because Banter shares authentication, database, and deep cross-linking with BigBlueBam.
            When someone types <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">BAM-247</code> in
            a channel, it links directly to the task. When an AI agent triages a helpdesk ticket, it
            can post the update to <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">#support-triage</code>.
            Sprint reports can be shared to channels with one click. Same users, same permissions,
            same audit trail.
          </p>
        </div>
      </AnimatedReveal>

      {/* Feature grid */}
      <AnimatedReveal delay={0.2}>
        <div className="mt-10">
          <h3 className="mb-6 text-center text-sm font-semibold tracking-wider text-zinc-400 uppercase">
            Feature status
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {featureTable.map((f) => (
              <div
                key={f.label}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-2.5">
                  <f.icon className="h-4 w-4 text-zinc-400" />
                  <span className="text-sm font-medium text-zinc-700">{f.label}</span>
                </div>
                <Badge
                  variant={
                    f.status === 'Stable' ? 'green' : f.status === 'Alpha' ? 'orange' : 'default'
                  }
                >
                  {f.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </AnimatedReveal>

      {/* Screenshot grid */}
      <AnimatedReveal delay={0.25} withScale>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div>
            <FloatingFrame
              src="/screenshots/banter-search.png"
              alt="Banter search with channel, author, and date filters"
            />
            <p className="mt-3 text-center text-sm text-zinc-500">
              Full-text search across channels with author, date, and attachment filters
            </p>
          </div>
          <div>
            <FloatingFrame
              src="/screenshots/banter-browse.png"
              alt="Browse and join public channels"
            />
            <p className="mt-3 text-center text-sm text-zinc-500">
              Browse and join public channels with member counts and descriptions
            </p>
          </div>
        </div>
      </AnimatedReveal>

      {/* Capabilities breakdown */}
      <AnimatedReveal delay={0.3}>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <Hash className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Channels & DMs</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Public and private channels with topics, member management, and role hierarchy. 1:1 and
              group DMs with presence indicators. Threaded replies keep conversations organized.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
              <Link2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Deep Integration</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Task references render as interactive chips with status tooltips. Share tasks, sprints,
              and tickets to channels with rich embed cards. Activity feed bots auto-post project
              updates.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">AI-Native</h3>
            <p className="mt-2 text-sm text-zinc-600">
              44 dedicated MCP tools let AI agents post messages, manage channels, react, search
              conversations, and even join voice calls as spoken participants with STT/TTS pipelines.
            </p>
          </div>
        </div>
      </AnimatedReveal>

      {/* Voice & calls */}
      <AnimatedReveal delay={0.35} withScale>
        <div className="mt-10 grid items-center gap-8 lg:grid-cols-2">
          <div>
            <Badge variant="orange" className="mb-3">
              Alpha
            </Badge>
            <h3 className="text-xl font-bold text-zinc-900">Voice, video & huddles</h3>
            <p className="mt-3 text-zinc-600">
              Start a voice or video call from any channel. Huddles are lightweight persistent audio
              rooms — drop in and out without a formal meeting. Screen sharing, recording, and live
              transcription are built in.
            </p>
            <p className="mt-3 text-zinc-600">
              The AI Voice Agent pipeline (STT &rarr; LLM &rarr; TTS) lets AI agents participate in
              calls as spoken participants, with graceful fallback to text when voice services aren't
              configured.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                'LiveKit SFU',
                'Screen Share',
                'Recording',
                'Transcription',
                'AI Voice Agent',
              ].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <FloatingFrame
            src="/screenshots/banter-admin.png"
            alt="Banter admin panel — voice and video configuration"
          />
        </div>
      </AnimatedReveal>

      {/* CTA */}
      <AnimatedReveal delay={0.4}>
        <div className="mt-10 flex items-center justify-center gap-4 text-center">
          <Button href="/banter/" variant="primary" size="md">
            Try Banter <ArrowRight className="h-4 w-4" />
          </Button>
          <Button href="#cta" variant="outline" size="md">
            <Users className="h-4 w-4" /> Get Started
          </Button>
        </div>
      </AnimatedReveal>
    </SectionWrapper>
  );
}
