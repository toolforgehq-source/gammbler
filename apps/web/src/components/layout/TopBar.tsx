'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { profileAPI } from '@/lib/api';

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

interface SearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
}

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const title = pageTitles[pathname] || 'Gammbler';

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    if (query.length < 2) {
      if (results.length > 0) setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await profileAPI.search(query);
        if (!controller.signal.aborted) {
          setResults(res.data.users || []);
        }
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => { clearTimeout(timeout); controller.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setQuery('');
        setResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (username: string) => {
    setSearchOpen(false);
    setQuery('');
    setResults([]);
    router.push(`/dashboard/profile/${username}`);
  };

  return (
    <header className="h-16 bg-secondary border-b border-accent/20 hidden lg:flex items-center justify-between px-8 sticky top-0 z-40">
      <h1
        className="text-xl font-bold uppercase tracking-wider"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h1>
      <div className="flex items-center gap-4" ref={dropdownRef}>
        {/* Search */}
        <div className="relative">
          {searchOpen ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search users..."
                  className="w-64 pl-9 pr-8 py-2 bg-card border border-accent/20 rounded-lg text-sm text-white placeholder-muted-dark focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  onClick={() => { setSearchOpen(false); setQuery(''); setResults([]); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg hover:bg-card transition-colors text-muted hover:text-white"
            >
              <Search size={20} />
            </button>
          )}

          {/* Search results dropdown */}
          {searchOpen && (query.length >= 2) && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-card border border-accent/20 rounded-lg shadow-xl overflow-hidden z-50">
              {loading ? (
                <div className="p-3 text-sm text-muted-dark text-center">Searching...</div>
              ) : results.length === 0 ? (
                <div className="p-3 text-sm text-muted-dark text-center">No users found</div>
              ) : (
                results.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelect(user.username)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/10 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent overflow-hidden">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        user.username[0].toUpperCase()
                      )}
                    </div>
                    <span className="text-sm text-white font-medium">@{user.username}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
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
