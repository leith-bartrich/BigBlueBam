import { useState, useEffect, useMemo, useCallback } from 'react';
import { Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { useScrollSpy } from '@/lib/use-scroll-spy';
import { Button } from '@/components/ui/button';

const navLinks: { label: string; id: string; href?: string }[] = [
  { label: 'Human + AI', id: 'ai-collaboration' },
  { label: 'Bam', id: 'features' },
  { label: 'Views', id: 'views' },
  { label: 'Sprints', id: 'sprints' },
  { label: 'Banter', id: 'banter' },
  { label: 'Helpdesk', id: 'helpdesk' },
  { label: 'Beacon', id: 'beacon' },
  { label: 'Brief', id: 'brief' },
  { label: 'Bolt', id: 'bolt' },
  { label: 'Bearing', id: 'bearing' },
  { label: 'Board', id: 'board' },
  { label: 'Bond', id: 'bond' },
  { label: 'Deploy', id: 'deploy', href: '/deploy' },
];

/**
 * Scroll to a section, continuously correcting for layout shifts.
 *
 * The page uses AnimatedReveal (opacity-0 → visible on scroll) and
 * lazy images that change document height as the user scrolls down.
 * A single scrollTo will land short because the target moves after
 * the scroll starts. Instead, we poll with rAF: on each frame we
 * check whether the element is within tolerance of the viewport
 * target. If not, we nudge window.scrollBy the delta. This produces
 * a single smooth motion that self-corrects rather than visible
 * re-jumps.
 */
function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  const NAV_H = 64;       // fixed navbar height
  const TOLERANCE = 2;     // px — close enough
  const TIMEOUT = 3000;    // give up after 3s

  const start = performance.now();
  let raf = 0;

  // Kick off the initial smooth scroll
  const targetTop = el.getBoundingClientRect().top + window.scrollY - NAV_H;
  window.scrollTo({ top: targetTop, behavior: 'smooth' });

  const check = () => {
    const rect = el.getBoundingClientRect();
    const offset = rect.top - NAV_H;

    if (Math.abs(offset) <= TOLERANCE) {
      // We've arrived
      return;
    }

    if (performance.now() - start > TIMEOUT) {
      // Safety bail — just jump to final position
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - NAV_H });
      return;
    }

    // Nudge by the remaining error. Using scrollBy avoids fighting
    // the browser's ongoing smooth scroll — it just adjusts the
    // destination as the page reflows underneath.
    window.scrollBy({ top: offset, behavior: 'auto' });

    raf = requestAnimationFrame(check);
  };

  // Start checking after a short delay so the initial smooth scroll
  // has begun and we don't immediately override it with a jump.
  setTimeout(() => { raf = requestAnimationFrame(check); }, 120);

  // Clean up if the user scrolls manually (e.g. grabs the scrollbar)
  const abort = () => { cancelAnimationFrame(raf); window.removeEventListener('wheel', abort); window.removeEventListener('touchstart', abort); };
  window.addEventListener('wheel', abort, { once: true, passive: true });
  window.addEventListener('touchstart', abort, { once: true, passive: true });
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sectionIds = useMemo(() => navLinks.map((l) => l.id), []);
  const activeId = useScrollSpy(sectionIds);

  const handleNavClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    scrollToSection(id);
    window.history.replaceState(null, '', `#${id}`);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={clsx(
        'fixed top-0 right-0 left-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-zinc-200/50 bg-white/80 shadow-sm backdrop-blur-lg'
          : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
            B
          </div>
          <span className="text-lg font-bold text-zinc-900">BigBlueBam</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={link.href ?? `#${link.id}`}
              onClick={link.href ? undefined : (e) => handleNavClick(e, link.id)}
              className={clsx(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                activeId === link.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-zinc-600 hover:text-zinc-900',
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <a
            href="/docs"
            className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
          >
            Docs
          </a>
          <Button href="/deploy" size="sm">
            Get Started
          </Button>
        </div>

        {/* Mobile menu toggle */}
        <button
          type="button"
          className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-zinc-200 bg-white px-4 pb-4 md:hidden">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={link.href ?? `#${link.id}`}
              onClick={link.href ? () => setMobileOpen(false) : (e) => { handleNavClick(e, link.id); setMobileOpen(false); }}
              className={clsx(
                'block rounded-md px-3 py-2.5 text-sm font-medium',
                activeId === link.id
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-zinc-600 hover:bg-zinc-50',
              )}
            >
              {link.label}
            </a>
          ))}
          <div className="mt-3 border-t border-zinc-100 pt-3">
            <Button href="#cta" size="sm" className="w-full">
              Get Started
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
