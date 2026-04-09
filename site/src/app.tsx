import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { Hero } from '@/components/sections/hero';
import { FeaturesOverview } from '@/components/sections/features-overview';
import { KanbanShowcase } from '@/components/sections/kanban-showcase';
import { ViewsShowcase } from '@/components/sections/views-showcase';
import { SprintSection } from '@/components/sections/sprint-section';
import { Collaboration } from '@/components/sections/collaboration';
import { UserManagement } from '@/components/sections/user-management';
import { PowerFeatures } from '@/components/sections/power-features';
import { Integrations } from '@/components/sections/integrations';
import { HelpdeskSection } from '@/components/sections/helpdesk-section';
import { BeaconSection } from '@/components/sections/beacon-section';
import { BriefSection } from '@/components/sections/brief-section';
import { BoltSection } from '@/components/sections/bolt-section';
import { BearingSection } from '@/components/sections/bearing-section';
import { BoardSection } from '@/components/sections/board-section';
import { BanterStub } from '@/components/sections/banter-stub';
import { Architecture } from '@/components/sections/architecture';
import { AiCollaboration } from '@/components/sections/ai-collaboration';
import { Cta } from '@/components/sections/cta';
import { DocsPage } from '@/pages/docs';
import { DeployGuidePage } from '@/pages/deploy-guide';

export function App() {
  const path = window.location.pathname;

  if (path.startsWith('/deploy')) {
    return <DeployGuidePage />;
  }

  if (path.startsWith('/docs')) {
    return <DocsPage />;
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <Hero />
        <AiCollaboration />
        <FeaturesOverview />
        <KanbanShowcase />
        <ViewsShowcase />
        <SprintSection />
        <Collaboration />
        <UserManagement />
        <PowerFeatures />
        <Integrations />
        <BanterStub />
        <HelpdeskSection />
        <BeaconSection />
        <BriefSection />
        <BoltSection />
        <BearingSection />
        <BoardSection />
        <Architecture />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
