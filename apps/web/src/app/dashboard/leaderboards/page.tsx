'use client';

import { useEffect, useState, useCallback } from 'react';
import { leaderboardsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Users, Globe, Share2, Lock, Swords } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import VerifiedBadge from '@/components/ui/VerifiedBadge';


interface LeaderboardEntry {
  rank: number | null;
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: string;
  is_unlocked?: boolean;
  settled_bet_count?: number;
  win_rate: string | null;
  roi: string | null;
  is_self: boolean;
  locked_label?: string;
  is_verified?: boolean;
}

const SPORTS = [
  { key: 'overall', label: 'Overall' },
  { key: 'nfl', label: 'NFL' },
  { key: 'nba', label: 'NBA' },
  { key: 'mlb', label: 'MLB' },
  { key: 'nhl', label: 'NHL' },
  { key: 'cfb', label: 'CFB' },
  { key: 'cbb', label: 'CBB' },
  { key: 'soccer', label: 'Soccer' },
  { key: 'prizepicks', label: 'PrizePicks' },
  { key: 'dfs', label: 'DFS' },
];

export default function LeaderboardsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [sport, setSport] = useState('overall');
  const [tab, setTab] = useState<'friends' | 'national'>('friends');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userPosition, setUserPosition] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const isFree = user?.tier === 'free' || (!user?.tier && user?.subscription_status !== 'active' && user?.subscription_status !== 'trialing');

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'friends' && isFree && sport !== 'overall') {
        setLeaderboard([]);
        setLoading(false);
        return;
      }
      const res = tab === 'friends'
        ? await leaderboardsAPI.friends(sport)
        : await leaderboardsAPI.national(sport);
      setLeaderboard(res.data.leaderboard || []);
      setUserPosition(res.data.user_position || null);
    } catch {
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  }, [sport, tab]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Sport Tabs */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          {SPORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSport(s.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors uppercase tracking-wide ${
                sport === s.key
                  ? 'bg-accent text-background'
                  : 'bg-card text-muted border border-accent/20 hover:text-white'
              }`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Friends / National Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('friends')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'friends'
              ? 'bg-accent text-background'
              : 'bg-card text-muted border border-accent/20 hover:text-white'
          }`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Users size={16} /> FRIENDS
        </button>
        <button
          onClick={() => setTab('national')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            tab === 'national'
              ? 'bg-accent text-background'
              : 'bg-card text-muted border border-accent/20 hover:text-white'
          }`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Globe size={16} /> NATIONAL
        </button>
      </div>

      {/* Invite Friends */}
      {tab === 'friends' && (
        <button className="flex items-center gap-2 px-4 py-2 bg-accent/20 text-accent rounded-lg text-sm hover:bg-accent/30 transition-colors">
          <Share2 size={16} />
          <span style={{ fontFamily: 'var(--font-display)' }} className="uppercase tracking-wide">
            Invite Friends
          </span>
        </button>
      )}

      {/* Leaderboard Table */}
      {tab === 'friends' && isFree && sport !== 'overall' ? (
        <div className="bg-card border border-accent/20 rounded-lg p-8 text-center space-y-4">
          <Lock size={32} className="text-accent mx-auto" />
          <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
            Per-Sport Friend Leaderboards are Pro
          </h3>
          <p className="text-sm text-muted-dark max-w-md mx-auto">
            You can see the <span className="text-accent font-medium">Overall</span> friend leaderboard for free. 
            Upgrade to Pro to compare scores across all 10 sports with your friends.
          </p>
          <button
            onClick={() => setSport('overall')}
            className="px-5 py-2.5 bg-accent/20 text-accent rounded-lg text-sm font-semibold hover:bg-accent/30 transition-colors"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            VIEW OVERALL FRIENDS
          </button>
          <div>
            <Link href="/dashboard/settings" className="text-sm text-accent hover:text-accent-light font-medium">
              Upgrade to Pro
            </Link>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-dark">No rankings available yet for this category.</p>
        </div>
      ) : (
        <div className="bg-card border border-accent/20 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[2rem_1fr_3.5rem] sm:grid-cols-12 gap-2 sm:gap-4 px-3 sm:px-6 py-3 bg-secondary text-xs uppercase tracking-wider text-muted-dark border-b border-accent/20" style={{ fontFamily: 'var(--font-display)' }}>
            <div className="sm:col-span-1">Rank</div>
            <div className="sm:col-span-3">Player</div>
            <div className="text-right sm:col-span-2">Score</div>
            <div className="hidden sm:block sm:col-span-2 text-right">Record</div>
            <div className="hidden sm:block sm:col-span-2 text-right">ROI</div>
            <div className="hidden sm:block sm:col-span-2 text-right"></div>
          </div>

          {/* Rows */}
          {leaderboard.map((entry, i) => (
            <div
              key={`${entry.user_id}-${i}`}
              className={`grid grid-cols-[2rem_1fr_3.5rem] sm:grid-cols-12 gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4 items-center border-b border-accent/10 hover:bg-secondary/50 transition-colors ${
                entry.is_self ? 'bg-accent/10' : ''
              }`}
            >
              <div className="sm:col-span-1">
                {entry.rank ? (
                  <span className={`text-base sm:text-lg font-bold ${entry.rank <= 3 ? 'text-gold' : 'text-muted'}`} style={{ fontFamily: 'var(--font-number)' }}>
                    {entry.rank}
                  </span>
                ) : (
                  <span className="text-xs text-muted-dark">—</span>
                )}
              </div>
              <Link href={`/dashboard/profile/${entry.username}`} className="sm:col-span-3 flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xs flex-shrink-0">
                  {entry.avatar_url ? (
                    <img src={entry.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    entry.username.charAt(0).toUpperCase()
                  )}
                </div>
                <span className={`text-sm font-medium truncate ${entry.is_self ? 'text-accent' : 'text-white'}`}>
                  {entry.username}
                  {entry.is_self && <span className="text-xs text-accent ml-1">(You)</span>}
                </span>
                {entry.is_verified && <VerifiedBadge size="sm" />}
              </Link>
              <div className="text-right sm:col-span-2">
                {entry.locked_label ? (
                  <span className="text-xs text-muted-dark">{entry.locked_label}</span>
                ) : (
                  <span className="text-base sm:text-lg font-bold text-accent" style={{ fontFamily: 'var(--font-number)' }}>
                    {parseFloat(entry.score).toFixed(1)}
                  </span>
                )}
              </div>
              <div className="hidden sm:block sm:col-span-2 text-right text-sm text-muted">
                {entry.win_rate ? `${(parseFloat(entry.win_rate) * 100).toFixed(0)}%` : '—'}
              </div>
              <div className="hidden sm:block sm:col-span-2 text-right">
                {entry.roi ? (
                  <span className={`text-sm font-medium ${parseFloat(entry.roi) >= 0 ? 'text-win' : 'text-loss'}`}>
                    {parseFloat(entry.roi) >= 0 ? '+' : ''}{parseFloat(entry.roi).toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-sm text-muted-dark">—</span>
                )}
              </div>
              <div className="hidden sm:flex sm:col-span-2 justify-end">
                {!entry.is_self && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/challenges?opponent=${entry.username}`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/30 text-accent rounded-md text-xs font-semibold hover:bg-accent/20 transition-colors"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    <Swords size={12} />
                    Challenge
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* User's own position if not in visible list */}
      {userPosition && !leaderboard.some((e) => e.is_self) && (
        <div className="bg-card border-2 border-accent rounded-lg p-4">
          <p className="text-sm text-muted-dark mb-1" style={{ fontFamily: 'var(--font-display)' }}>YOUR POSITION</p>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold text-accent" style={{ fontFamily: 'var(--font-number)' }}>
              #{userPosition.rank}
            </span>
            <span className="text-sm text-muted">
              Score: {parseFloat(userPosition.score).toFixed(1)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
