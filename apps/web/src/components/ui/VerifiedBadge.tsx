'use client';

import Image from 'next/image';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function VerifiedBadge({ size = 'sm', className = '' }: VerifiedBadgeProps) {
  const imgSize = size === 'sm' ? 14 : size === 'md' ? 18 : 22;
  const textSize = size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-sm';

  return (
    <span
      className={`inline-flex items-center gap-0.5 bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-semibold ${textSize} ${className}`}
      title="Verified Score — Connected via sportsbook"
    >
      <Image
        src="/badges/verified.png"
        alt="Verified"
        width={imgSize}
        height={imgSize}
        className="object-contain"
        unoptimized
      />
      Verified
    </span>
  );
}
