'use client';

import { useEffect, useState } from 'react';
import { cappersAPI, scoresAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  Crown, Shield,
  UserPlus, UserMinus, Award,
} from 'lucide-react';

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
  total_subscribers: number;
  total_tails: number;
  total_earnings_cents: number;
  verified_at: string;
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

export default function CappersPage() {
  const { user } = useAuthStore();
  const [cappers, setCappers] = useState<Capper[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('score');
  const [canApply, setCanApply] = useState(false);
  const [userScore, setUserScore] = useState(0);
  const [applyLoading, setApplyLoading] = useState(false);

  useEffect(() => {
    fetchCappers();
    checkEligibility();
  }, [sort]);

  async function fetchCappers() {
    try {
      setLoading(true);
      const res = await cappersAPI.list({ sort });
      setCappers(res.data.cappers || []);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }

  async function checkEligibility() {
    try {
      const res = await scoresAPI.getAll();
      const overall = res.data.scores?.find((s: { sport: string; score?: string; settled_bet_count?: number }) => s.sport === 'overall');
      if (overall?.score) {
        const score = parseFloat(overall.score);
        setUserScore(score);
        setCanApply(score >= 80 && (overall.settled_bet_count || 0) >= 100);
      }
    } catch {
      // handled
    }
  }

  async function handleApply() {
    setApplyLoading(true);
    try {
      await cappersAPI.apply();
      alert('You are now a Verified Capper! Set up your profile to start earning.');
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            VERIFIED CAPPERS
          </h1>
          <p className="text-muted-dark text-sm mt-1">Subscribe to top bettors. Tail their picks.</p>
        </div>
        {canApply && (
          <button
            onClick={handleApply}
            disabled={applyLoading}
            className="flex items-center gap-2 px-4 py-2 bg-gold text-background rounded-lg font-semibold hover:bg-gold/80 transition-colors disabled:opacity-50"
          >
            <Crown size={18} />
            <span style={{ fontFamily: 'var(--font-display)' }}>
              {applyLoading ? 'APPLYING...' : 'BECOME A CAPPER'}
            </span>
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-card border border-gold/20 rounded-lg p-4 flex items-start gap-3">
        <Shield size={20} className="text-gold mt-0.5 shrink-0" />
        <div className="text-sm text-muted">
          <p><span className="text-gold font-semibold">Verified Cappers</span> have a Gammbler Score of 80+ with 100+ settled bets.</p>
          <p className="mt-1">Subscribe to get instant access to their live bet slips and one-tap copy betting.</p>
          <p className="text-muted-dark mt-1">Gammbler takes a 30% platform fee. Cappers keep 70%.</p>
        </div>
      </div>

      {/* Sort */}
      <div className="flex gap-2">
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

      {/* Cappers List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : cappers.length === 0 ? (
        <div className="bg-card border border-accent/20 rounded-lg p-12 text-center">
          <Crown size={48} className="mx-auto text-muted-dark mb-4" />
          <p className="text-muted-dark text-lg">No verified cappers yet</p>
          <p className="text-muted-dark text-sm mt-1">
            {userScore >= 80 ? 'You qualify! Apply to become the first.' : `Reach an 80+ score to become a Verified Capper. Current: ${userScore.toFixed(1)}`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cappers.map((capper) => {
            const score = parseFloat(capper.current_score);
            return (
              <div
                key={capper.id}
                className="bg-card border border-accent/20 rounded-lg p-5 hover:border-accent/40 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar + Info */}
                  <div className="w-14 h-14 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold text-xl shrink-0">
                    {capper.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-lg" style={{ fontFamily: 'var(--font-display)' }}>
                        {capper.display_name}
                      </h3>
                      <span className="px-2 py-0.5 bg-gold/20 text-gold text-xs font-semibold rounded-full flex items-center gap-1">
                        <Award size={10} /> VERIFIED
                      </span>
                    </div>
                    <p className="text-muted-dark text-sm">@{capper.user.username}</p>
                    {capper.bio && <p className="text-muted text-sm mt-1 line-clamp-1">{capper.bio}</p>}
                  </div>

                  {/* Score */}
                  <div className="text-center shrink-0">
                    <p className={`text-3xl font-bold ${getScoreColor(score)}`} style={{ fontFamily: 'var(--font-number)' }}>
                      {score.toFixed(1)}
                    </p>
                    <p className={`text-xs font-semibold ${getScoreColor(score)}`}>{getTierName(score)}</p>
                  </div>

                  {/* Stats */}
                  <div className="flex gap-4 shrink-0">
                    <div className="text-center">
                      <p className="text-white font-bold" style={{ fontFamily: 'var(--font-number)' }}>{capper.total_subscribers}</p>
                      <p className="text-xs text-muted-dark">Subs</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold" style={{ fontFamily: 'var(--font-number)' }}>{capper.total_tails}</p>
                      <p className="text-xs text-muted-dark">Tails</p>
                    </div>
                  </div>

                  {/* Price + Subscribe */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-accent font-bold" style={{ fontFamily: 'var(--font-number)' }}>
                        ${(capper.price_cents / 100).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-dark">/month</p>
                    </div>
                    {capper.user_id !== user?.id && (
                      capper.is_subscribed ? (
                        <button
                          onClick={() => handleUnsubscribe(capper.user_id)}
                          className="px-4 py-2 border border-accent/40 text-accent rounded-lg text-sm font-semibold hover:bg-accent/10 transition-colors flex items-center gap-1"
                        >
                          <UserMinus size={14} /> Subscribed
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSubscribe(capper.user_id)}
                          className="px-4 py-2 bg-accent text-background rounded-lg text-sm font-semibold hover:bg-accent-light transition-colors flex items-center gap-1"
                        >
                          <UserPlus size={14} /> Subscribe
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
