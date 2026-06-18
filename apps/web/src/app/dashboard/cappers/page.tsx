'use client';

import { useEffect, useState } from 'react';
import { cappersAPI, scoresAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Crown, Shield, Star, Settings,
  UserPlus, UserMinus, Award, Users,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface CapperUser {
  username: string;
  avatar_url: string | null;
}

interface Capper {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  price_cents: number;
  status: string;
  banner_url: string | null;
  profile_photo_url: string | null;
  favorite_sports: string[] | null;
  favorite_teams: string[] | null;
  betting_style: string | null;
  social_links: Record<string, string> | null;
  tier: 'capper' | 'verified' | 'elite';
  total_subscribers: number;
  total_followers: number;
  total_tails: number;
  total_earnings_cents: number;
  verified_at: string | null;
  verified_score: string;
  user: CapperUser;
  current_score: string;
  is_subscribed: boolean;
}

function getScoreColor(score: number): string {
  if (score <= 40) return 'text-loss';
  if (score <= 60) return 'text-gold';
  if (score <= 75) return 'text-accent-light';
  if (score <= 90) return 'text-accent';
  return 'text-gold';
}

function getTierName(score: number): string {
  if (score <= 40) return 'Recreational';
  if (score <= 60) return 'Developing';
  if (score <= 75) return 'Sharp';
  if (score <= 90) return 'Elite';
  return 'Legend';
}

function getCapperTierDisplay(tier: string): { label: string; color: string; bgColor: string; icon: typeof Crown } {
  switch (tier) {
    case 'elite':
      return { label: 'ELITE CAPPER', color: 'text-gold', bgColor: 'bg-gold/20', icon: Crown };
    case 'verified':
      return { label: 'VERIFIED CAPPER', color: 'text-accent', bgColor: 'bg-accent/20', icon: Shield };
    default:
      return { label: 'CAPPER', color: 'text-muted', bgColor: 'bg-secondary', icon: Users };
  }
}

export default function CappersPage() {
  const { user } = useAuthStore();
  const [cappers, setCappers] = useState<Capper[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('score');
  const [tierFilter, setTierFilter] = useState('all');
  const [isCapper, setIsCapper] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);

  useEffect(() => {
    fetchCappers();
    checkCapperStatus();
  }, [sort, tierFilter]);

  async function fetchCappers() {
    try {
      setLoading(true);
      const params: Record<string, string> = { sort };
      if (tierFilter !== 'all') params.tier = tierFilter;
      const res = await cappersAPI.list(params);
      setCappers(res.data.cappers || []);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }

  async function checkCapperStatus() {
    try {
      const res = await cappersAPI.myEarnings();
      if (res.data) setIsCapper(true);
    } catch {
      setIsCapper(false);
    }
  }

  async function handleApply() {
    setApplyLoading(true);
    try {
      await cappersAPI.apply();
      alert('You are now a Capper! Set up your profile to start building your audience.');
      setIsCapper(true);
      fetchCappers();
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: string } } })?.response?.data;
      alert(errData?.error || 'Failed to apply');
    } finally {
      setApplyLoading(false);
    }
  }

  async function handleSubscribe(capperId: string) {
    try {
      await cappersAPI.subscribe(capperId);
      fetchCappers();
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: string } } })?.response?.data;
      alert(errData?.error || 'Failed to subscribe');
    }
  }

  async function handleUnsubscribe(capperId: string) {
    try {
      await cappersAPI.unsubscribe(capperId);
      fetchCappers();
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: string } } })?.response?.data;
      alert(errData?.error || 'Failed to unsubscribe');
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            CAPPER MARKETPLACE
          </h1>
          <p className="text-muted-dark text-sm mt-1">Subscribe to cappers. Tail their picks. Build your own audience.</p>
        </div>
        <div className="flex items-center gap-2">
          {isCapper && (
            <Link
              href="/dashboard/cappers/edit"
              className="flex items-center gap-2 px-4 py-2 border border-accent/40 text-accent rounded-lg font-semibold hover:bg-accent/10 transition-colors"
            >
              <Settings size={16} />
              <span className="hidden sm:inline">Edit Profile</span>
            </Link>
          )}
          {!isCapper && (
            <button
              onClick={handleApply}
              disabled={applyLoading}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-background rounded-lg font-semibold hover:bg-accent-light transition-colors disabled:opacity-50 shrink-0"
            >
              <Star size={18} />
              <span style={{ fontFamily: 'var(--font-display)' }}>
                {applyLoading ? 'APPLYING...' : 'BECOME A CAPPER'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Info banner — capper tiers explained */}
      <div className="bg-card border border-accent/20 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Shield size={20} className="text-accent mt-0.5 shrink-0" />
          <div className="text-sm text-muted space-y-2">
            <p><span className="text-white font-semibold">Anyone can become a Capper</span> — no minimum score required. Start posting picks and building your audience immediately.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
              <div className="bg-secondary rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Users size={14} className="text-muted" />
                  <span className="text-xs font-bold text-muted">CAPPER</span>
                </div>
                <p className="text-xs text-muted-dark">Any user. Post picks, build followers.</p>
              </div>
              <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield size={14} className="text-accent" />
                  <span className="text-xs font-bold text-accent">VERIFIED CAPPER</span>
                </div>
                <p className="text-xs text-muted-dark">Score 75+ with 50+ tracked picks. Performance-proven.</p>
              </div>
              <div className="bg-gold/5 border border-gold/20 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Crown size={14} className="text-gold" />
                  <span className="text-xs font-bold text-gold">ELITE CAPPER</span>
                </div>
                <p className="text-xs text-muted-dark">Score 85+ with 100+ tracked picks. Top-tier performance.</p>
              </div>
            </div>
            <p className="text-muted-dark mt-1">Follow cappers to see their live bet slips. Paid subscriptions and creator monetization coming soon.</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Tier filter */}
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All Cappers' },
            { value: 'verified', label: 'Verified' },
            { value: 'elite', label: 'Elite' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setTierFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                tierFilter === opt.value
                  ? 'bg-accent/20 text-accent'
                  : 'bg-secondary text-muted-dark hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-2 sm:ml-auto">
          {[
            { value: 'score', label: 'Highest Score' },
            { value: 'subscribers', label: 'Most Popular' },
            { value: 'tails', label: 'Most Tailed' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                sort === opt.value
                  ? 'bg-accent/20 text-accent'
                  : 'bg-secondary text-muted-dark hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cappers List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : cappers.length === 0 ? (
        <div className="bg-card border border-accent/20 rounded-lg p-12 text-center">
          <Users size={48} className="mx-auto text-muted-dark mb-4" />
          <p className="text-muted-dark text-lg">No cappers found</p>
          <p className="text-muted-dark text-sm mt-1">
            {tierFilter !== 'all'
              ? `No ${tierFilter} cappers yet. Try "All Cappers" filter.`
              : 'Be the first! Click "Become a Capper" to start posting picks.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cappers.map((capper) => {
            const score = parseFloat(capper.current_score);
            const tierDisplay = getCapperTierDisplay(capper.tier);
            const TierIcon = tierDisplay.icon;
            return (
              <div
                key={capper.id}
                className="bg-card border border-accent/20 rounded-lg p-4 sm:p-5 hover:border-accent/40 transition-colors"
              >
                {/* Mobile layout: stacked */}
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Avatar */}
                  <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-bold text-lg sm:text-xl shrink-0 ${
                    capper.tier === 'elite' ? 'bg-gold/20 text-gold' :
                    capper.tier === 'verified' ? 'bg-accent/20 text-accent' :
                    'bg-secondary text-muted'
                  }`}>
                    {capper.display_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + Tier badge row */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white text-base sm:text-lg truncate" style={{ fontFamily: 'var(--font-display)' }}>
                        {capper.display_name}
                      </h3>
                      <span className={`px-2 py-0.5 ${tierDisplay.bgColor} ${tierDisplay.color} text-xs font-semibold rounded-full flex items-center gap-1`}>
                        <TierIcon size={10} /> {tierDisplay.label}
                      </span>
                    </div>
                    <p className="text-muted-dark text-sm truncate">@{capper.user.username}</p>
                    {capper.bio && <p className="text-muted text-sm mt-1 line-clamp-1 hidden sm:block">{capper.bio}</p>}
                    {capper.favorite_sports && capper.favorite_sports.length > 0 && (
                      <div className="flex gap-1 mt-1 hidden sm:flex">
                        {capper.favorite_sports.slice(0, 4).map((sport: string) => (
                          <span key={sport} className="px-1.5 py-0.5 bg-accent/10 text-accent text-[10px] rounded">{sport}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Score - visible on all sizes */}
                  <div className="text-center shrink-0">
                    <p className={`text-2xl sm:text-3xl font-bold ${getScoreColor(score)}`} style={{ fontFamily: 'var(--font-number)' }}>
                      {score.toFixed(1)}
                    </p>
                    <p className={`text-xs font-semibold ${getScoreColor(score)}`}>{getTierName(score)}</p>
                  </div>
                </div>

                {/* Stats + Subscribe row */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-accent/10">
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-number)' }}>{capper.total_subscribers}</p>
                      <p className="text-xs text-muted-dark">Subs</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold text-sm" style={{ fontFamily: 'var(--font-number)' }}>{capper.total_tails}</p>
                      <p className="text-xs text-muted-dark">Tails</p>
                    </div>
                    <div className="text-center">
                      <p className="text-accent font-bold text-sm" style={{ fontFamily: 'var(--font-number)' }}>
                        Free
                      </p>
                      <p className="text-xs text-muted-dark">to follow</p>
                    </div>
                  </div>
                  {capper.user_id !== user?.id && (
                    capper.is_subscribed ? (
                      <button
                        onClick={() => handleUnsubscribe(capper.user_id)}
                        className="px-3 sm:px-4 py-2 border border-accent/40 text-accent rounded-lg text-sm font-semibold hover:bg-accent/10 transition-colors flex items-center gap-1"
                      >
                        <UserMinus size={14} /> <span className="hidden sm:inline">Following</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSubscribe(capper.user_id)}
                        className="px-3 sm:px-4 py-2 bg-accent text-background rounded-lg text-sm font-semibold hover:bg-accent-light transition-colors flex items-center gap-1"
                      >
                        <UserPlus size={14} /> <span className="hidden sm:inline">Follow</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
