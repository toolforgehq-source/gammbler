'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';

interface UpgradeBannerProps {
  feature: string;
  description?: string;
  compact?: boolean;
}

export default function UpgradeBanner({ feature, description, compact }: UpgradeBannerProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-lg px-4 py-3">
        <Lock size={14} className="text-accent flex-shrink-0" />
        <p className="text-xs text-accent-light flex-1">
          {feature} — <Link href="/subscribe" className="underline font-semibold">Upgrade to Pro</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-accent/30 rounded-lg p-6 text-center">
      <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
        <Lock size={24} className="text-accent" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
        {feature}
      </h3>
      {description && (
        <p className="text-sm text-muted-dark mb-4">{description}</p>
      )}
      <Link
        href="/subscribe"
        className="inline-block bg-accent text-background px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider hover:brightness-110 transition"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Upgrade to Pro — $8.99/mo
      </Link>
      <p className="text-xs text-muted-dark mt-3">Unlock the full Gammbler experience</p>
    </div>
  );
}
