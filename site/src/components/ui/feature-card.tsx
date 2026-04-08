import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-2 text-base font-semibold text-zinc-900">{title}</h3>
      <p className="text-sm leading-relaxed text-zinc-600">{description}</p>
    </motion.div>
  );
}
