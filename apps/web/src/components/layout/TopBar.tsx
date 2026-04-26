'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const pageTitles: Record<string, string> = {
  '/dashboard': 'My Stats',
  '/dashboard/feed': 'Community',
  '/dashboard/leaderboards': 'Leaderboards',
  '/dashboard/profile': 'Profile',
  '/dashboard/settings': 'Settings',
  '/dashboard/add-bet': 'Add Bet',
  '/dashboard/achievements': 'Achievements',
  '/dashboard/insights': 'Insights',
};

export default function TopBar() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'Gammbler';

  return (
    <header className="h-16 bg-secondary border-b border-accent/20 flex items-center justify-between px-8 sticky top-0 z-40">
      <h1
        className="text-xl font-bold uppercase tracking-wider"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h1>
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/notifications"
          className="relative p-2 rounded-lg hover:bg-card transition-colors text-muted hover:text-white"
        >
          <Bell size={20} />
        </Link>
      </div>
    </header>
  );
}
