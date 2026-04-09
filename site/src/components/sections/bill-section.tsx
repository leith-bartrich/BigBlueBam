import {
  DollarSign,
  ArrowRight,
  FileText,
  CreditCard,
  Users,
  RefreshCw,
} from 'lucide-react';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { AnimatedReveal } from '@/components/ui/animated-reveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const features = [
  {
    icon: FileText,
    title: 'Invoice Builder',
    description:
      'Professional invoice editor with line items, tax calculations, discounts, and customizable templates.',
    color: 'bg-green-100 text-green-600',
  },
  {
    icon: CreditCard,
    title: 'Payment Tracking',
    description:
      'Track payment status, send reminders, record partial payments, and reconcile against bank transactions.',
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    icon: Users,
    title: 'Client Portal',
    description:
      'Clients view invoices, download PDFs, and submit payments through a branded self-service portal.',
    color: 'bg-teal-100 text-teal-600',
  },
  {
    icon: RefreshCw,
    title: 'Recurring Billing',
    description:
      'Set up recurring invoices on any schedule with automatic generation, sending, and overdue escalation.',
    color: 'bg-green-100 text-green-600',
  },
];

export function BillSection() {
  return (
    <SectionWrapper id="bill" dividerTop>
      <AnimatedReveal>
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <Badge variant="green" className="mb-4">
            Invoicing
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Get paid faster
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Create professional invoices, track payments, manage clients, and automate recurring
            billing. Bill integrates with Bond contacts and Bench analytics for a complete financial
            picture.
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
        <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-gradient-to-r from-green-50 to-emerald-50 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-green-600" />
            <p className="text-sm font-medium text-zinc-700">
              Served at{' '}
              <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs">/bill/</code> — a
              dedicated SPA sharing authentication and the client model with Bond and Bench.
            </p>
          </div>
          <Button href="/bill/" variant="primary" size="sm">
            Try Bill <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </AnimatedReveal>
    </SectionWrapper>
  );
}
