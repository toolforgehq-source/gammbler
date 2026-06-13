'use client';

import { useEffect, useState } from 'react';
import { creatorDiscoveryAPI } from '@/lib/api';
import { Users, TrendingUp, Sparkles, Star, Crown, UserPlus, Heart, Award, Trophy, Shield, PenTool, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface Creator {
  user_id: string;
  username: string;
  display_name: string;
  bio: string | null;
  profile_photo_url: string | null;
  total_subscribers: number;
  total_followers: number;
  betting_style: string | null;
  favorite_sports: string[];
  betting_score: number | null;
  creator_badges: string[];
  metric_value: number | string;
  metric_label: string;
  rank: number;
}

const SECTIONS = [
  { key: 'trending', label: 'Trending', icon: TrendingUp, description: 'Most engagement in the last 7 days' },
  { key: 'growing', label: 'Fastest Growing', icon: Sparkles, description: 'Most new followers in 30 days' },
  { key: 'new', label: 'New Creators', icon: UserPlus, description: 'Recently joined the platform' },
  { key: 'subscribers', label: 'Most Subscribers', icon: Star, description: 'Top creators by subscriber count' },
  { key: 'followers', label: 'Most Followed', icon: Users, description: 'Top creators by follower count' },
];

const SPORTS = ['NFL', 'NBA', 'MLB', 'NHL', 'Soccer', 'Golf', 'DFS'];

const BADGE_ICONS: Record<string, typeof Award> = {
  first_follower: UserPlus, '100_followers': Users, '500_followers': Users, '1000_followers': Users, '5000_followers': Users,
  first_subscriber: Star, '10_subscribers': Star, '50_subscribers': Star, '100_subscribers': Crown, '500_subscribers': Crown,
  first_post: PenTool, '25_posts': PenTool, '100_posts': PenTool, '500_posts': BookOpen,
  rising_creator: TrendingUp, community_favorite: Heart, community_builder: Award, league_commissioner: Shield,
  top_10_creator: Trophy, top_creator: Crown,
};

function getTierLabel(score: number | null): { label: string; color: string } {
  if (score === null) return { label: 'Unranked', color: 'text-muted' };
  if (score >= 95) return { label: 'Legend', color: 'text-yellow-400' };
  if (score >= 85) return { label: 'Elite', color: 'text-purple-400' };
  if (score >= 75) return { label: 'Sharp', color: 'text-accent' };
  if (score >= 60) return { label: 'Competitive', color: 'text-blue-400' };
  return { label: 'Recreational', color: 'text-muted' };
}

export default function CreatorDiscoveryPage() {
  const [section, setSection] = useState('trending');
  const [sport, setSport] = useState<string | null>(null);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        if (sport) params.sport = sport;
        const res = await creatorDiscoveryAPI.get(section, params);
        if (!cancelled) setCreators(res.data.creators || []);
      } catch {
        if (!cancelled) setCreators([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [section, sport]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
          Discover Creators
        </h1>
        <p className="text-muted text-sm mt-1">
          Find creators worth following — filter by category, sport, or growth metrics.
        </p>
      </div>

      {/* Section Tabs */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = section === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-accent text-white'
                  : 'bg-surface border border-white/10 text-muted hover:text-white hover:border-accent/50'
              }`}
            >
              <Icon size={16} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Sport Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSport(null)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            !sport ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-surface border border-white/10 text-muted hover:text-white'
          }`}
        >
          All Sports
        </button>
        {SPORTS.map((s) => (
          <button
            key={s}
            onClick={() => setSport(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              sport === s ? 'bg-accent/20 text-accent border border-accent/50' : 'bg-surface border border-white/10 text-muted hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Section Description */}
      <div className="flex items-center gap-2 bg-surface/50 border border-white/5 rounded-lg px-4 py-3">
        <TrendingUp size={16} className="text-accent" />
        <p className="text-sm text-muted">
          {SECTIONS.find((s) => s.key === section)?.description}
          {sport && ` • Filtered by ${sport}`}
        </p>
      </div>

      {/* Creator Cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-surface border border-white/5 rounded-xl p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-white/10 rounded" />
                  <div className="h-3 w-48 bg-white/10 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : creators.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-white/5 rounded-xl">
          <Users size={48} className="mx-auto text-muted mb-4" />
          <h3 className="text-lg font-bold mb-2">No Creators Found</h3>
          <p className="text-muted text-sm">
            {sport ? `No creators found for ${sport}. Try a different sport or remove the filter.` : 'Be the first to create content!'}
          </p>
          <Link
            href="/dashboard/cappers"
            className="inline-block mt-4 px-6 py-2 rounded-lg bg-accent text-white text-sm font-bold hover:bg-accent/80"
          >
            Become a Creator
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {creators.map((creator) => {
            const tier = getTierLabel(creator.betting_score);
            return (
              <div
                key={creator.user_id}
                className="bg-surface border border-white/5 rounded-xl p-5 hover:border-accent/30 transition-all"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <Link href={`/dashboard/profile/${creator.username}`} className="shrink-0">
                    {creator.profile_photo_url ? (
                      <img
                        src={creator.profile_photo_url}
                        alt={creator.display_name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-white/10"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-accent/20 border-2 border-accent/30 flex items-center justify-center text-accent font-bold text-lg">
                        {creator.display_name?.[0] || creator.username?.[0] || '?'}
                      </div>
                    )}
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/dashboard/profile/${creator.username}`}
                        className="font-bold text-white hover:text-accent transition-colors truncate"
                      >
                        {creator.display_name}
                      </Link>
                      <span className="text-xs text-muted">@{creator.username}</span>
                    </div>

                    {/* Bio */}
                    {creator.bio && (
                      <p className="text-xs text-muted mt-1 line-clamp-2">{creator.bio}</p>
                    )}

                    {/* Badges */}
                    {creator.creator_badges && creator.creator_badges.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {creator.creator_badges.slice(0, 5).map((badgeId) => {
                          const BadgeIcon = BADGE_ICONS[badgeId] || Award;
                          return (
                            <span
                              key={badgeId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[10px]"
                              title={badgeId.replace(/_/g, ' ')}
                            >
                              <BadgeIcon size={10} />
                            </span>
                          );
                        })}
                        {creator.creator_badges.length > 5 && (
                          <span className="text-[10px] text-muted">+{creator.creator_badges.length - 5}</span>
                        )}
                      </div>
                    )}

                    {/* Metrics Row */}
                    <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                      <span className={`font-semibold ${tier.color}`}>
                        {creator.betting_score ? `${creator.betting_score} ${tier.label}` : 'Score Locked'}
                      </span>
                      <span className="text-muted flex items-center gap-1">
                        <Users size={11} /> {creator.total_followers} followers
                      </span>
                      <span className="text-muted flex items-center gap-1">
                        <Star size={11} /> {creator.total_subscribers} subs
                      </span>
                    </div>

                    {/* Favorite Sports */}
                    {creator.favorite_sports && creator.favorite_sports.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {(creator.favorite_sports as string[]).slice(0, 4).map((s) => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Metric Badge */}
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-bold text-accent">{creator.metric_value}</div>
                    <div className="text-[10px] text-muted">{creator.metric_label}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Philosophy Footer */}
      <div className="mt-8 p-6 rounded-xl bg-surface/30 border border-white/5 text-center">
        <p className="text-sm text-muted">
          Discover creators who succeed through betting skill, content creation, community building, or audience growth.
        </p>
        <p className="text-sm mt-1">
          <span className="text-accent font-semibold">All paths to success are valued on Gammbler.</span>
        </p>
      </div>
    </div>
  );
}
