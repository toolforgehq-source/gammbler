'use client';

import { useEffect, useState } from 'react';
import { creatorLeaderboardsAPI } from '@/lib/api';
import { Users, TrendingUp, Heart, Star, Crown, Award } from 'lucide-react';
import Link from 'next/link';

interface CreatorEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  display_name: string;
  bio: string | null;
  profile_photo_url: string | null;
  total_subscribers: number;
  total_followers: number;
  betting_style: string | null;
  favorite_sports: string[];
  metric_value: number;
  metric_label: string;
  betting_score: number | null;
  score_unlocked: boolean;
}

const CATEGORIES = [
  { key: 'subscribers', label: 'Most Subscribers', icon: Star, description: 'Total active subscribers' },
  { key: 'followers', label: 'Most Followed', icon: Users, description: 'Total followers' },
  { key: 'growing', label: 'Fastest Growing', icon: TrendingUp, description: 'New followers in last 30 days' },
  { key: 'engaged', label: 'Most Engaged', icon: Heart, description: 'Total post engagement' },
];

function getTierLabel(score: number | null): { label: string; color: string } {
  if (score === null) return { label: 'Unranked', color: 'text-muted' };
  if (score >= 95) return { label: 'Legend', color: 'text-yellow-400' };
  if (score >= 85) return { label: 'Elite', color: 'text-purple-400' };
  if (score >= 75) return { label: 'Sharp', color: 'text-accent' };
  if (score >= 60) return { label: 'Competitive', color: 'text-blue-400' };
  return { label: 'Recreational', color: 'text-muted' };
}

export default function CreatorLeaderboardsPage() {
  const [category, setCategory] = useState('subscribers');
  const [leaderboard, setLeaderboard] = useState<CreatorEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await creatorLeaderboardsAPI.get(category);
        if (!cancelled) setLeaderboard(res.data.leaderboard || []);
      } catch {
        if (!cancelled) setLeaderboard([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [category]);

  const activeCategory = CATEGORIES.find((c) => c.key === category)!;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-black text-white tracking-tight uppercase"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Creator Rankings
        </h1>
        <p className="text-muted text-sm mt-1">
          Top creators ranked by audience growth, engagement, and community impact — independent from betting performance.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors uppercase tracking-wide ${
                  category === cat.key
                    ? 'bg-accent text-background'
                    : 'bg-card text-muted border border-accent/20 hover:text-white'
                }`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <Icon size={16} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      <div className="bg-card border border-accent/20 rounded-lg px-4 py-3 flex items-center gap-3">
        <Award size={18} className="text-accent shrink-0" />
        <p className="text-sm text-muted">
          <span className="text-white font-medium">{activeCategory.label}</span> — {activeCategory.description}. 
          Betting performance is always shown for transparency.
        </p>
      </div>

      {/* Leaderboard */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-card border border-accent/20 rounded-lg p-4 animate-pulse h-24" />
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="bg-card border border-accent/20 rounded-lg p-12 text-center">
          <Crown size={40} className="text-accent/40 mx-auto mb-3" />
          <h3 className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-display)' }}>
            No Creators Yet
          </h3>
          <p className="text-muted text-sm mt-1">
            Be the first to build an audience on Gammbler.
          </p>
          <Link
            href="/dashboard/cappers"
            className="inline-block mt-4 px-5 py-2 bg-accent text-background rounded-lg text-sm font-semibold hover:bg-accent-light transition-colors"
          >
            Become a Creator
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {leaderboard.map((entry) => {
            const tier = getTierLabel(entry.betting_score);
            const isTopThree = entry.rank <= 3;

            return (
              <div
                key={entry.user_id}
                className={`bg-card border rounded-lg p-4 flex items-center gap-4 transition-colors hover:border-accent/40 ${
                  isTopThree ? 'border-accent/40' : 'border-accent/20'
                }`}
              >
                {/* Rank */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${
                  entry.rank === 1
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                    : entry.rank === 2
                    ? 'bg-gray-300/20 text-gray-300 border border-gray-300/40'
                    : entry.rank === 3
                    ? 'bg-amber-600/20 text-amber-500 border border-amber-600/40'
                    : 'bg-card text-muted border border-accent/20'
                }`} style={{ fontFamily: 'var(--font-display)' }}>
                  #{entry.rank}
                </div>

                {/* Avatar */}
                <Link href={`/dashboard/profile/${entry.username}`} className="shrink-0">
                  {entry.profile_photo_url ? (
                    <img
                      src={entry.profile_photo_url}
                      alt={entry.display_name}
                      className="w-12 h-12 rounded-full object-cover border border-accent/20"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold text-lg border border-accent/20">
                      {entry.display_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/dashboard/profile/${entry.username}`}
                      className="font-bold text-white hover:text-accent transition-colors truncate"
                    >
                      {entry.display_name}
                    </Link>
                    <span className="text-xs text-muted">@{entry.username}</span>
                  </div>
                  {entry.bio && (
                    <p className="text-xs text-muted mt-0.5 line-clamp-1">{entry.bio}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {/* Betting Score */}
                    <span className={`text-xs font-semibold ${tier.color}`}>
                      {entry.betting_score !== null ? `${entry.betting_score.toFixed(1)} ${tier.label}` : 'Score Locked'}
                    </span>
                    {/* Followers */}
                    <span className="text-xs text-muted">
                      <Users size={11} className="inline mr-0.5" />
                      {entry.total_followers} followers
                    </span>
                    {/* Subscribers */}
                    <span className="text-xs text-muted">
                      <Star size={11} className="inline mr-0.5" />
                      {entry.total_subscribers} subs
                    </span>
                    {/* Betting Style */}
                    {entry.betting_style && (
                      <span className="text-xs text-muted/60">{entry.betting_style}</span>
                    )}
                  </div>
                </div>

                {/* Metric Value */}
                <div className="text-right shrink-0">
                  <div className="text-xl font-black text-accent" style={{ fontFamily: 'var(--font-display)' }}>
                    {entry.metric_value.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted">{entry.metric_label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Philosophy Note */}
      <div className="bg-secondary border border-accent/10 rounded-lg p-4 text-center">
        <p className="text-xs text-muted">
          Creator Rankings reward audience growth and engagement. Betting Leaderboards reward performance.
          <br />
          <span className="text-accent">Both paths lead to success on Gammbler.</span>
        </p>
      </div>
    </div>
  );
}
