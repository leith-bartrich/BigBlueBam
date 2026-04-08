import { ArrowRight, BookOpen } from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { AnimatedReveal } from '@/components/ui/animated-reveal';
import { Button } from '@/components/ui/button';

export function Cta() {
  return (
    <SectionWrapper id="cta" dark dividerTop className="relative overflow-hidden">
      {/* Gradient accent */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-900/20 via-transparent to-primary-800/10" />

      <div className="relative mx-auto max-w-2xl text-center">
        <AnimatedReveal>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Put humans and AI agents on the same team
          </h2>
          <p className="mt-4 text-lg text-primary-200">
            One command. Your infrastructure. AI-native from day one.
          </p>

          <div className="mt-8 overflow-hidden rounded-lg border border-primary-700/50 bg-primary-950/80 text-left">
            <div className="flex items-center gap-2 border-b border-primary-800/50 px-4 py-2">
              <div className="h-2 w-2 rounded-full bg-red-400/70" />
              <div className="h-2 w-2 rounded-full bg-yellow-400/70" />
              <div className="h-2 w-2 rounded-full bg-green-400/70" />
              <span className="ml-2 text-xs text-primary-400">terminal</span>
            </div>
            <pre className="overflow-x-auto p-4 text-sm">
              <code className="text-primary-200">
                <span className="text-primary-500">$</span> git clone https://github.com/eoffermann/BigBlueBam{'\n'}
                <span className="text-primary-500">$</span> cp .env.example .env{'\n'}
                <span className="text-primary-500">$</span> docker compose up -d{'\n'}
                <span className="text-emerald-400">{'>'} BigBlueBam is running at http://localhost</span>
              </code>
            </pre>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="/b3/" variant="white" size="lg">
              Sign up to test <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              href="https://github.com/eoffermann/BigBlueBam/blob/main/README.md"
              variant="outline"
              size="lg"
              className="!border-primary-400/30 !text-zinc-200 hover:!bg-primary-900/50 hover:!text-zinc-100"
            >
              <BookOpen className="h-4 w-4" /> Read the Docs
            </Button>
          </div>
        </AnimatedReveal>
      </div>
    </SectionWrapper>
  );
}
