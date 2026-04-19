import {
  FileText,
  ArrowRight,
  LayoutTemplate,
  Bot,
  PenTool,
  List,
} from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { FloatingFrame } from '@/components/ui/floating-frame';
import { AnimatedReveal } from '@/components/ui/animated-reveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function BriefSection() {
  return (
    <SectionWrapper id="brief" dividerTop>
      <AnimatedReveal>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge variant="green" className="mb-4">
            New
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Documents that live next to your code
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            A rich-text collaborative editor with a formatting toolbar, auto-generated table of
            contents, and slash commands. 33 built-in templates across 7 categories, real-time
            co-editing, version history, and a graduation path that lets polished documents become
            Beacons when they mature into lasting knowledge.
          </p>
        </div>
      </AnimatedReveal>

      {/* Hero screenshots */}
      <div className="grid gap-8 lg:grid-cols-2">
        <AnimatedReveal delay={0.1} withScale>
          <FloatingFrame src="/screenshots/brief-home.png" alt="Brief Home" />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Brief Home -- recent documents, templates, and quick-create actions
          </p>
        </AnimatedReveal>
        <AnimatedReveal delay={0.15} withScale>
          <FloatingFrame src="/screenshots/brief-documents.png" alt="Brief document browser" />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Document browser -- filter by project, author, template, and status
          </p>
        </AnimatedReveal>
      </div>

      {/* Feature highlights */}
      <AnimatedReveal delay={0.2}>
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
              <PenTool className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">WYSIWYG Editor</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Tiptap-based rich text with a formatting toolbar, heading dropdown, tables, code
              blocks, task lists, slash commands, and syntax highlighting.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">33 Templates</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Meeting notes, PRDs, RFCs, post-mortems, onboarding guides, and more across 7
              categories -- business operations, engineering, strategy, HR, communications, sales,
              and creative.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <List className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Auto Table of Contents</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Generated in real-time from document headings. Clickable navigation that updates as
              you type, keeping long documents easy to browse.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <Bot className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">AI Co-authoring</h3>
            <p className="mt-2 text-sm text-zinc-600">
              AI agents create, edit, comment on, upsert by slug, and graduate documents through
              18 MCP tools. Attachment metadata surfaces through a federated dispatcher so agents
              see mime, size, scan verdict, and uploader without reaching into object storage.
            </p>
          </div>
        </div>
      </AnimatedReveal>

      {/* Editor screenshots */}
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <AnimatedReveal delay={0.25} withScale>
          <FloatingFrame
            src="/screenshots/brief-editor.png"
            alt="Brief WYSIWYG Editor — new document"
          />
          <p className="mt-3 text-center text-sm text-zinc-500">
            WYSIWYG editor with formatting toolbar and Table of Contents
          </p>
        </AnimatedReveal>
        <AnimatedReveal delay={0.3} withScale>
          <FloatingFrame
            src="/screenshots/brief-editor-with-content.png"
            alt="Brief WYSIWYG Editor — editing"
          />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Editing an existing document with rich text
          </p>
        </AnimatedReveal>
      </div>

      {/* Templates screenshot */}
      <AnimatedReveal delay={0.35} withScale>
        <div className="mt-10">
          <FloatingFrame
            src="/screenshots/brief-templates.png"
            alt="Brief Template Library"
          />
          <p className="mt-3 text-center text-sm text-zinc-500">
            33 built-in templates across 7 categories -- business operations, engineering, strategy,
            HR, communications, sales, and creative
          </p>
        </div>
      </AnimatedReveal>

      {/* Templates in editor */}
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <AnimatedReveal delay={0.4} withScale>
          <FloatingFrame
            src="/screenshots/brief-template-meeting-notes.png"
            alt="Meeting Notes template loaded in the editor"
          />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Meeting Notes template — agenda, attendees, and action items
          </p>
        </AnimatedReveal>
        <AnimatedReveal delay={0.45} withScale>
          <FloatingFrame
            src="/screenshots/brief-template-prd.png"
            alt="PRD template loaded in the editor"
          />
          <p className="mt-3 text-center text-sm text-zinc-500">
            PRD template — metadata, problem statement, requirements, rollout
          </p>
        </AnimatedReveal>
      </div>

      {/* Detail screenshot */}
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <AnimatedReveal delay={0.4} withScale>
          <FloatingFrame
            src="/screenshots/brief-detail.png"
            alt="Brief document detail with inline comments"
          />
          <p className="mt-3 text-center text-sm text-zinc-500">
            Document detail -- inline comments, version history, and metadata sidebar
          </p>
        </AnimatedReveal>
      </div>

      <AnimatedReveal delay={0.45}>
        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary-600" />
            <p className="text-sm font-medium text-zinc-700">
              Served at{' '}
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs">/brief/</code> — a
              dedicated SPA sharing authentication and the project model with Bam and Beacon.
            </p>
          </div>
          <Button href="/brief/" variant="primary" size="sm">
            Try Brief <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </AnimatedReveal>
    </SectionWrapper>
  );
}
