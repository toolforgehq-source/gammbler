'use client';

import { ShieldCheck } from 'lucide-react';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function VerifiedBadge({ size = 'sm', className = '' }: VerifiedBadgeProps) {
  const iconSize = size === 'sm' ? 12 : size === 'md' ? 14 : 16;
  const textSize = size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-sm';

  return (
    <span
      className={`inline-flex items-center gap-0.5 bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-semibold ${textSize} ${className}`}
      title="Verified Score — Connected via sportsbook"
    >
      <ShieldCheck size={iconSize} />
      Verified
    </span>
  );
}
