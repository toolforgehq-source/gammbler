'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard,
  Activity,
  Trophy,
  User,
  Settings,
  LogOut,
  PlusCircle,
  Swords,
  Share2,
  Crown,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';

const navItems = [
  { href: '/dashboard/feed', label: 'Community', icon: Activity },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/slips', label: 'Bet Slips', icon: Share2 },
  { href: '/dashboard/cappers', label: 'Cappers', icon: Crown },
  { href: '/dashboard/leaderboards', label: 'Leaderboards', icon: Trophy },
  { href: '/dashboard/leagues', label: 'Leagues', icon: Swords },
  { href: '/dashboard/profile', label: 'Profile', icon: User },
];

const bottomItems = [
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-secondary flex flex-col border-r border-accent/20 z-50">
      {/* Logo */}
      <div className="p-6 border-b border-accent/20">
        <Link href="/dashboard">
          <Image
            src="/images/logo-main.png"
            alt="Gammbler"
            width={220}
            height={48}
            className="h-12 w-auto"
            priority
          />
        </Link>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/20 text-accent'
                  : 'text-muted hover:bg-card hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Add Bet Button */}
        <Link
          href="/dashboard/add-bet"
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium bg-accent text-background hover:bg-accent-light transition-colors mt-4"
        >
          <PlusCircle size={20} />
          <span className="uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
            Add Bet
          </span>
        </Link>
      </nav>

      {/* Bottom Nav */}
      <div className="p-4 border-t border-accent/20 space-y-1">
        {bottomItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/20 text-accent'
                  : 'text-muted hover:bg-card hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* User info */}
        {user && (
          <div className="flex items-center gap-3 px-4 py-3 mt-2">
            <div className="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center text-accent font-bold text-sm">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.username}</p>
              <p className="text-xs text-muted-dark truncate">{user.email}</p>
            </div>
            <button onClick={logout} className="text-muted-dark hover:text-loss transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
