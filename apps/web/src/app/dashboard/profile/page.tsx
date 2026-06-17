'use client';

import { useEffect, useState } from 'react';
import { profileAPI, badgesAPI, dfsAPI, scoresAPI } from '@/lib/api';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import { useAuthStore } from '@/lib/store';
import { Settings, Calendar, TrendingUp, Users, Download, Gamepad2, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { shareableAPI } from '@/lib/api';
import Link from 'next/link';
import FollowListModal from '@/components/ui/FollowListModal';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
  is_profile_public: boolean;
  scores: Array<{
    sport: string;
    score: string;
    is_unlocked: boolean;
    settled_bet_count: number;
  }>;
  badges: Array<{
    badge_type: string;
    earned_at: string;
  }>;
  record: { wins: number; losses: number; pushes: number };
  roi: number;
  followers: number;
  following: number;
  is_self: boolean;
  total_profit_loss?: number;
  is_verified?: boolean;
  capper_tier: 'capper' | 'verified' | 'elite' | null;
}

interface BadgeInfo {
  badge_type: string;
  name: string;
  description: string;
  icon: string;
  image?: string;
  earned: boolean;
  earned_at: string | null;
}

function getScoreColor(score: number): string {
  if (score <= 40) return 'text-loss';
  if (score <= 60) return 'text-gold';
  if (score <= 75) return 'text-accent-light';
  if (score <= 90) return 'text-accent';
  return 'text-gold';
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allBadges, setAllBadges] = useState<BadgeInfo[]>([]);
  const [totalBadgeCount, setTotalBadgeCount] = useState(0);
  const [totalEarnedCount, setTotalEarnedCount] = useState(0);
  const [scoreHistory, setScoreHistory] = useState<Record<string, Array<{ date: string; score: number }>>>({});
  const [dfsScores, setDfsScores] = useState<Array<{ sport: string; score: string; is_unlocked: boolean; total_contests: number; roi: string; cash_rate: string }>>([]);
  const [dfsBadges, setDfsBadges] = useState<Array<{ badge_type: string; earned_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [nationalRank, setNationalRank] = useState<{ rank: number | null; total_ranked: number } | null>(null);
  const [verification, setVerification] = useState<{
    verification_pct: number;
    verification_level: string;
  } | null>(null);
  const [followListType, setFollowListType] = useState<'followers' | 'following' | null>(null);
  const cardSport = 'overall';

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      try {
        const [profileRes, badgesRes, historyRes, dfsScoresRes, dfsBadgesRes, rankRes, categoriesRes] = await Promise.all([
          profileAPI.get(user.username),
          badgesAPI.getAll(),
          profileAPI.scoreHistory(user.username),
          dfsAPI.getScores().catch(() => ({ data: { scores: [] } })),
          dfsAPI.getBadges().catch(() => ({ data: { badges: [] } })),
          scoresAPI.getMyRank().catch(() => ({ data: { rank: null, total_ranked: 0 } })),
          badgesAPI.getAllCategories().catch(() => ({ data: { total: 0, earned: 0 } })),
        ]);
        setProfile(profileRes.data.profile);
        setAllBadges(badgesRes.data.badges || []);
        setTotalBadgeCount(categoriesRes.data.total || 0);
        setTotalEarnedCount(categoriesRes.data.earned || 0);
        setScoreHistory(historyRes.data.history || {});
        setDfsScores(dfsScoresRes.data.scores || []);
        setDfsBadges(dfsBadgesRes.data.badges || []);
        setNationalRank(rankRes.data);

        // Fetch verification stats
        if (profileRes.data.profile?.id) {
          scoresAPI.getVerification(profileRes.data.profile.id).then((vRes) => {
            setVerification(vRes.data);
          }).catch(() => {});
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [user]);

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const overallScore = profile.scores.find((s) => s.sport === 'overall');
  const scoreVal = overallScore ? parseFloat(overallScore.score) : 0;
  const earnedBadges = allBadges.filter((b) => b.earned);

  async function handleShareCard() {
    setGeneratingCard(true);
    try {
      const res = await shareableAPI.generateCard(cardSport);
      const blob = new Blob([res.data], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gammbler-${profile?.username}-${cardSport}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setGeneratingCard(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Profile Header */}
      <div className="bg-card border border-accent/20 rounded-lg p-4 sm:p-8">
        <div className="flex items-start gap-4 sm:gap-6">
          <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-2xl sm:text-3xl flex-shrink-0" style={{ fontFamily: 'var(--font-display)' }}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full rounded-full object-cover" />
            ) : (
              profile.username.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                {profile.username}
              </h2>
              {profile.is_verified && <VerifiedBadge size="md" />}
              {profile.is_self && (
                <Link href="/dashboard/settings" className="text-muted-dark hover:text-white">
                  <Settings size={18} />
                </Link>
              )}
            </div>

            {/* Score + Tier */}
            {overallScore?.is_unlocked ? (
              <div className="flex items-center gap-4 mb-2 flex-wrap">
                <span className={`text-4xl font-bold ${getScoreColor(scoreVal)}`} style={{ fontFamily: 'var(--font-number)' }}>
                  {scoreVal.toFixed(1)}
                </span>
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  scoreVal > 90 ? 'bg-gold/20 text-gold' :
                  scoreVal > 75 ? 'bg-accent/20 text-accent' :
                  scoreVal > 60 ? 'bg-accent-light/20 text-accent-light' :
                  scoreVal > 40 ? 'bg-gold/20 text-gold' :
                  'bg-loss/20 text-loss'
                }`}>
                  {scoreVal <= 40 ? 'Recreational' : scoreVal <= 60 ? 'Developing' : scoreVal <= 75 ? 'Sharp' : scoreVal <= 90 ? 'Elite' : 'Legend'}
                </span>
                {nationalRank?.rank && (
                  <Link href="/dashboard/leaderboards" className="text-sm font-semibold px-3 py-1 rounded-full bg-gold/20 text-gold hover:bg-gold/30 transition-colors" style={{ fontFamily: 'var(--font-number)' }}>
                    #{nationalRank.rank} National
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-dark mb-2">Score locked — {overallScore?.settled_bet_count || 0}/10 bets needed</p>
            )}
            {/* Capper Tier Badge — shown regardless of score unlock status */}
            {profile.capper_tier && (
              <div className="flex items-center gap-2 mb-4">
                {profile.capper_tier === 'elite' && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-gold/20 text-gold">ELITE CAPPER</span>
                )}
                {profile.capper_tier === 'verified' && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-accent/20 text-accent">VERIFIED CAPPER</span>
                )}
                {profile.capper_tier === 'capper' && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-secondary text-muted">CAPPER</span>
                )}
              </div>
            )}

            {/* Verification Badge */}
            {verification && verification.verification_pct > 0 && (
              <div className="flex items-center gap-1.5 mb-3">
                <ShieldCheck size={14} className={
                  verification.verification_level === 'diamond' ? 'text-blue-400' :
                  verification.verification_level === 'gold' ? 'text-gold' :
                  verification.verification_level === 'silver' ? 'text-gray-300' :
                  'text-amber-700'
                } />
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  verification.verification_level === 'diamond' ? 'bg-blue-400/20 text-blue-400' :
                  verification.verification_level === 'gold' ? 'bg-gold/20 text-gold' :
                  verification.verification_level === 'silver' ? 'bg-gray-300/20 text-gray-300' :
                  'bg-amber-700/20 text-amber-700'
                }`}>
                  {verification.verification_pct}% Verified
                </span>
              </div>
            )}

            {/* Stats Row */}
            <div className="flex items-center gap-3 sm:gap-6 text-sm flex-wrap">
              <div>
                <span className="font-bold text-white" style={{ fontFamily: 'var(--font-number)' }}>
                  {profile.record.wins}-{profile.record.losses}-{profile.record.pushes}
                </span>
                <span className="text-muted-dark ml-1">Record</span>
              </div>
              <div>
                <span className={`font-bold ${profile.roi >= 0 ? 'text-win' : 'text-loss'}`} style={{ fontFamily: 'var(--font-number)' }}>
                  {profile.roi >= 0 ? '+' : ''}{profile.roi}%
                </span>
                <span className="text-muted-dark ml-1">ROI</span>
              </div>
              {profile.total_profit_loss !== undefined && (
                <div>
                  <span className={`font-bold ${profile.total_profit_loss >= 0 ? 'text-win' : 'text-loss'}`} style={{ fontFamily: 'var(--font-number)' }}>
                    {profile.total_profit_loss >= 0 ? '+' : ''}${Math.abs(profile.total_profit_loss).toFixed(2)}
                  </span>
                  <span className="text-muted-dark ml-1">P/L</span>
                </div>
              )}
              <button onClick={() => setFollowListType('followers')} className="flex items-center gap-1 text-muted-dark hover:text-accent transition-colors">
                <Users size={14} />
                <span className="font-bold text-white">{profile.followers}</span> followers
              </button>
              <button onClick={() => setFollowListType('following')} className="flex items-center gap-1 text-muted-dark hover:text-accent transition-colors">
                <span className="font-bold text-white">{profile.following}</span> following
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 text-xs text-muted-dark">
            <Calendar size={12} />
            Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          {profile.is_self && overallScore?.is_unlocked && (
            <button
              onClick={handleShareCard}
              disabled={generatingCard}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/30 text-accent rounded-lg text-xs font-semibold hover:bg-accent/20 transition-colors disabled:opacity-50"
            >
              <Download size={12} />
              {generatingCard ? 'Generating...' : 'Share Score Card'}
            </button>
          )}
        </div>
      </div>

      {/* Score History Chart */}
      {(scoreHistory.overall?.length ?? 0) > 0 && (
        <div className="bg-card border border-accent/20 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-accent" />
            <h3 className="text-sm uppercase tracking-wider text-muted-dark font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Score History
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreHistory.overall}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  stroke="#6b7280"
                  fontSize={11}
                  tickFormatter={(val: string) => {
                    const d = new Date(val + 'T00:00:00');
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#6b7280"
                  fontSize={11}
                  tickFormatter={(val: number) => val.toFixed(0)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a2e',
                    border: '1px solid rgba(0, 255, 136, 0.2)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: 13,
                  }}
                  labelFormatter={(label) => {
                    const d = new Date(String(label) + 'T00:00:00');
                    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                  }}
                  formatter={(value) => [Number(value).toFixed(1), 'Score']}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#00ff88"
                  strokeWidth={2}
                  dot={{ fill: '#00ff88', r: 3 }}
                  activeDot={{ r: 5, fill: '#00ff88' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sport Scores */}
      <div>
        <h3 className="text-sm uppercase tracking-wider text-muted-dark mb-4 font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Sport Scores
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {profile.scores.filter((s) => s.sport !== 'overall').map((s) => {
            const val = parseFloat(s.score);
            return (
              <div key={s.sport} className={`bg-card border border-accent/20 rounded-lg p-4 ${!s.is_unlocked ? 'opacity-50' : ''}`}>
                <p className="text-xs uppercase tracking-wider text-muted-dark mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                  {s.sport.toUpperCase()}
                </p>
                {s.is_unlocked ? (
                  <p className={`text-xl font-bold ${getScoreColor(val)}`} style={{ fontFamily: 'var(--font-number)' }}>
                    {val.toFixed(1)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-dark">{s.settled_bet_count}/10 bets</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* DFS Score Section */}
      {(() => {
        const dfsOverall = dfsScores.find((s) => s.sport === 'overall');
        const dfsSportScores = dfsScores.filter((s) => s.sport !== 'overall');

        function getDfsTier(score: number): { label: string; color: string } {
          if (score >= 91) return { label: 'Legend', color: 'text-yellow-400' };
          if (score >= 76) return { label: 'Elite', color: 'text-purple-400' };
          if (score >= 61) return { label: 'Sharp', color: 'text-accent' };
          if (score >= 41) return { label: 'Developing', color: 'text-blue-400' };
          return { label: 'Recreational', color: 'text-muted' };
        }

        return (
          <div className="bg-card border border-accent/20 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <Gamepad2 size={16} className="text-accent" />
              <h3 className="text-sm uppercase tracking-wider text-muted-dark font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                DFS Score
              </h3>
              <Link href="/dashboard/dfs" className="text-xs text-accent hover:text-accent-light ml-auto">
                View Dashboard →
              </Link>
            </div>

            {dfsOverall?.is_unlocked ? (
              <div className="flex items-center gap-6 mb-4">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#4caf50" strokeWidth="8"
                      strokeLinecap="round" strokeDasharray={`${(Number(dfsOverall.score) / 100) * 327} 327`} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold">{dfsOverall.score}</span>
                    <span className={`text-[10px] font-semibold ${getDfsTier(Number(dfsOverall.score)).color}`}>
                      {getDfsTier(Number(dfsOverall.score)).label}
                    </span>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-dark">Contests</p>
                    <p className="text-lg font-bold">{dfsOverall.total_contests}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-dark">ROI</p>
                    <p className={`text-lg font-bold ${Number(dfsOverall.roi) >= 0 ? 'text-accent' : 'text-loss'}`}>
                      {(Number(dfsOverall.roi) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-dark">Cash Rate</p>
                    <p className="text-lg font-bold">{(Number(dfsOverall.cash_rate) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-dark mb-2">
                  {dfsOverall ? `${20 - dfsOverall.total_contests} more contests to unlock` : 'No DFS contests yet'}
                </p>
                <Link href="/dashboard/dfs" className="text-sm text-accent hover:text-accent-light">
                  Start tracking your DFS performance →
                </Link>
              </div>
            )}

            {dfsSportScores.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {dfsSportScores.map((s) => (
                  <div key={s.sport} className={`bg-secondary rounded-lg p-2 text-center ${!s.is_unlocked ? 'opacity-40' : ''}`}>
                    <p className="text-[10px] uppercase text-muted-dark">{s.sport.toUpperCase()} DFS</p>
                    {s.is_unlocked ? (
                      <p className={`text-sm font-bold ${getDfsTier(Number(s.score)).color}`}>{s.score}</p>
                    ) : (
                      <p className="text-[10px] text-muted-dark">{s.total_contests}/20</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {dfsBadges.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted-dark mb-2">DFS Badges</p>
                <div className="flex flex-wrap gap-2">
                  {dfsBadges.map((b) => (
                    <span key={b.badge_type} className="inline-flex items-center gap-1 px-2 py-1 bg-accent/10 border border-accent/20 rounded-full text-xs text-accent capitalize">
                      <Image
                        src={`/badges/${b.badge_type}.png`}
                        alt={b.badge_type.replace(/^dfs_/, '').replace(/_/g, ' ')}
                        width={16}
                        height={16}
                        className="object-contain"
                        unoptimized
                      />
                      {b.badge_type.replace(/^dfs_/, '').replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Badges */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm uppercase tracking-wider text-muted-dark font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Badges ({totalEarnedCount || earnedBadges.length}/{totalBadgeCount || allBadges.length})
          </h3>
          <Link href="/dashboard/achievements" className="text-xs text-accent hover:text-accent-light">
            View All
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {allBadges.slice(0, 8).map((badge) => (
            <div
              key={badge.badge_type}
              className={`bg-card border rounded-lg p-3 text-center ${
                badge.earned ? 'border-gold/40' : 'border-accent/10 opacity-30'
              }`}
            >
              <div className={`relative mx-auto mb-1 ${badge.earned ? '' : 'grayscale'}`} style={{ width: 48, height: 48 }}>
                <Image
                  src={badge.image || `/badges/${badge.badge_type}.png`}
                  alt={badge.name}
                  width={48}
                  height={48}
                  className="object-contain drop-shadow-md"
                  unoptimized
                />
              </div>
              <p className="text-xs font-medium text-white truncate">{badge.name}</p>
              {badge.earned && badge.earned_at && (
                <p className="text-xs text-muted-dark mt-1">
                  {new Date(badge.earned_at).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Follow List Modal */}
      {followListType && profile && (
        <FollowListModal
          username={profile.username}
          type={followListType}
          onClose={() => setFollowListType(null)}
        />
      )}
    </div>
  );
}
