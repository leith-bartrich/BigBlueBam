import { Users, Building2, Key, History, ShieldAlert, Crown } from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { FloatingFrame } from '@/components/ui/floating-frame';
import { AnimatedReveal } from '@/components/ui/animated-reveal';

const features = [
  {
    icon: Users,
    title: 'People at the top level',
    description:
      'Search, filter, and bulk-act on every member of your org. Invite, disable, change roles, export to CSV — all from a dedicated page, not buried in Settings.',
  },
  {
    icon: Building2,
    title: 'Multi-org in one click',
    description:
      'Belong to many orgs. Switch with the header dropdown and the whole app re-scopes instantly. A persistent banner warns when an org has no active owner.',
  },
  {
    icon: Crown,
    title: 'SuperUser console',
    description:
      'Platform operators get a cross-org view of every user and org. Context-switch into any tenant, manage memberships, impersonate for support, all with a red banner that makes the privileged state impossible to miss.',
  },
  {
    icon: Key,
    title: 'Admin password reset + scoped keys',
    description:
      'Reset a user password (auto-generated or manual) with a one-time reveal. Mint API keys on their behalf, pinned to a single org, scoped to read / read-write / admin.',
  },
  {
    icon: ShieldAlert,
    title: 'Strictly-below rank rule',
    description:
      'Admins can only act on users at ranks strictly below them. A compromised admin account can never lock out its peers — only an owner or SuperUser can rotate them.',
  },
  {
    icon: History,
    title: 'Full audit trail',
    description:
      'Every session, every SuperUser action, every login attempt (success or failure) is recorded. Timeline views at the user level surface exactly who did what and when.',
  },
];

const tabs = [
  {
    title: 'Overview',
    src: '/screenshots/people-detail-overview.png',
    caption: 'Identity, membership, and disable controls',
  },
  {
    title: 'Projects',
    src: '/screenshots/people-detail-projects.png',
    caption: 'Per-project roles with bulk assign',
  },
  {
    title: 'Access',
    src: '/screenshots/people-detail-access.png',
    caption: 'Password reset, force-change, and API keys on behalf',
  },
  {
    title: 'Activity',
    src: '/screenshots/people-detail-activity.png',
    caption: 'Per-user audit trail',
  },
];

export function UserManagement() {
  return (
    <SectionWrapper id="user-management" alternate dividerTop>
      <AnimatedReveal>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            User management that scales with your team
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            A first-class People surface, a cross-org SuperUser console, and rank-gated
            actions that contain credential compromise. Built in from day one.
          </p>
        </div>
      </AnimatedReveal>

      <AnimatedReveal delay={0.1} withScale>
        <div className="mt-14">
          <FloatingFrame
            src="/screenshots/people-list.png"
            alt="People list — searchable, filterable, bulk-selectable"
          />
        </div>
      </AnimatedReveal>

      <AnimatedReveal delay={0.15} withScale>
        <div className="mt-20">
          <h3 className="text-center text-2xl font-semibold text-zinc-900">
            Four tabs per user
          </h3>
          <p className="mt-3 text-center text-zinc-600">
            Everything an admin needs without hunting through screens.
          </p>
          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            {tabs.map((tab) => (
              <div key={tab.title}>
                <FloatingFrame src={tab.src} alt={tab.caption} />
                <p className="mt-3 text-center text-sm font-medium text-zinc-600">
                  <span className="text-zinc-900">{tab.title}</span> — {tab.caption}
                </p>
              </div>
            ))}
          </div>
        </div>
      </AnimatedReveal>

      <AnimatedReveal delay={0.2}>
        <div className="mt-20 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-700">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </AnimatedReveal>

      <AnimatedReveal delay={0.25} withScale>
        <div className="mt-20 grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h3 className="text-2xl font-semibold text-zinc-900">
              SuperUser console — cross-org visibility
            </h3>
            <p className="mt-4 text-zinc-600">
              Platform operators see every user across every org on the server. Search
              globally, add users to arbitrary orgs, change their default, revoke
              sessions, or impersonate — with every action written to an append-only
              audit log.
            </p>
            <p className="mt-3 text-zinc-600">
              When context-switched into an org you don't natively belong to, a red
              banner and chip in the header make your privileged state impossible to
              miss.
            </p>
          </div>
          <FloatingFrame
            src="/screenshots/superuser-people-list.png"
            alt="SuperUser cross-org people list"
          />
        </div>
      </AnimatedReveal>

      <AnimatedReveal delay={0.3} withScale>
        <div className="mt-14 grid items-center gap-10 lg:grid-cols-2">
          <FloatingFrame
            src="/screenshots/superuser-context-banner.png"
            alt="SuperUser context banner"
          />
          <div>
            <h3 className="text-2xl font-semibold text-zinc-900">
              Never operate blind
            </h3>
            <p className="mt-4 text-zinc-600">
              A persistent red banner calls out when a SuperUser is viewing an org
              they're not a native member of. The current org chip in the header turns
              red. Writes made in this state are tagged{' '}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
                via_superuser_context
              </code>{' '}
              in the activity log, so the audit trail is unambiguous.
            </p>
          </div>
        </div>
      </AnimatedReveal>
    </SectionWrapper>
  );
}
