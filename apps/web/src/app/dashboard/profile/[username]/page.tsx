'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { profileAPI, scoresAPI } from '@/lib/api';
import VerifiedBadge from '@/components/ui/VerifiedBadge';
import { useAuthStore } from '@/lib/store';
import { Calendar, TrendingUp, Users, UserPlus, UserMinus, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
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
  is_following: boolean;
  is_self: boolean;
  total_profit_loss?: number;
  is_verified?: boolean;
}

function getScoreColor(score: number): string {
  if (score <= 40) return 'text-loss';
  if (score <= 60) return 'text-gold';
  if (score <= 75) return 'text-accent-light';
  if (score <= 90) return 'text-accent';
  return 'text-gold';
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [scoreHistory, setScoreHistory] = useState<Record<string, Array<{ date: string; score: number }>>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [verification, setVerification] = useState<{
    verification_pct: number;
    verification_level: string;
  } | null>(null);

  const username = params.username;

  useEffect(() => {
    if (!username) return;

    // If viewing own profile, redirect to /dashboard/profile
    if (user && user.username === username) {
      router.replace('/dashboard/profile');
      return;
    }

    async function fetchProfile() {
      try {
        const [profileRes, historyRes] = await Promise.all([
          profileAPI.get(username),
          profileAPI.scoreHistory(username),
        ]);
        setProfile(profileRes.data.profile);
        setScoreHistory(historyRes.data.history || {});

        if (profileRes.data.profile?.id) {
          scoresAPI.getVerification(profileRes.data.profile.id).then((vRes) => {
            setVerification(vRes.data);
          }).catch(() => {});
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [username, user, router]);

  async function handleFollow() {
    if (!profile || followLoading) return;
    setFollowLoading(true);
    try {
      if (profile.is_following) {
        await profileAPI.unfollow(profile.id);
        setProfile({ ...profile, is_following: false, followers: profile.followers - 1 });
      } else {
        await profileAPI.follow(profile.id);
        setProfile({ ...profile, is_following: true, followers: profile.followers + 1 });
      }
    } catch {
      // ignore
    } finally {
      setFollowLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-lg text-muted-dark">User not found</p>
        <Link href="/dashboard/leaderboards" className="text-accent hover:text-accent-light text-sm">
          ← Back to Leaderboards
        </Link>
      </div>
    );
  }

  const overallScore = profile.scores.find((s) => s.sport === 'overall');
  const scoreVal = overallScore ? parseFloat(overallScore.score) : 0;

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
            </div>

            {/* Score + Tier */}
            {overallScore?.is_unlocked ? (
              <div className="flex items-center gap-4 mb-4 flex-wrap">
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
              </div>
            ) : (
              <p className="text-sm text-muted-dark mb-4">Score locked — {overallScore?.settled_bet_count || 0}/10 bets needed</p>
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
              <div className="flex items-center gap-1 text-muted-dark">
                <Users size={14} />
                <span className="font-bold text-white">{profile.followers}</span> followers
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 text-xs text-muted-dark">
            <Calendar size={12} />
            Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          {user && !profile.is_self && (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                profile.is_following
                  ? 'bg-muted/20 border border-muted/30 text-muted-dark hover:bg-loss/20 hover:border-loss/30 hover:text-loss'
                  : 'bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20'
              }`}
            >
              {profile.is_following ? (
                <>
                  <UserMinus size={12} />
                  {followLoading ? 'Unfollowing...' : 'Following'}
                </>
              ) : (
                <>
                  <UserPlus size={12} />
                  {followLoading ? 'Following...' : 'Follow'}
                </>
              )}
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
      {profile.scores.filter((s) => s.sport !== 'overall').length > 0 && (
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
      )}

      {/* Badges */}
      {profile.badges.length > 0 && (
        <div>
          <h3 className="text-sm uppercase tracking-wider text-muted-dark mb-4 font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Badges ({profile.badges.length})
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {profile.badges.slice(0, 8).map((badge) => (
              <div
                key={badge.badge_type}
                className="bg-card border border-gold/40 rounded-lg p-3 text-center"
              >
                <div className="relative mx-auto mb-1" style={{ width: 48, height: 48 }}>
                  <Image
                    src={`/badges/${badge.badge_type}.png`}
                    alt={badge.badge_type.replace(/_/g, ' ')}
                    width={48}
                    height={48}
                    className="object-contain drop-shadow-md"
                    unoptimized
                  />
                </div>
                <p className="text-xs font-medium text-white truncate capitalize">
                  {badge.badge_type.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-muted-dark mt-1">
                  {new Date(badge.earned_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
