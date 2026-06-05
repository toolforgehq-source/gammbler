'use client';

import { useEffect, useState } from 'react';
import { profileAPI, badgesAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Settings, Calendar, TrendingUp, Users, Download } from 'lucide-react';
import { shareableAPI } from '@/lib/api';
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
  is_self: boolean;
  total_profit_loss?: number;
}

interface BadgeInfo {
  badge_type: string;
  name: string;
  description: string;
  icon: string;
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
  const [scoreHistory, setScoreHistory] = useState<Record<string, Array<{ date: string; score: number }>>>({});
  const [loading, setLoading] = useState(true);
  const [generatingCard, setGeneratingCard] = useState(false);
  const cardSport = 'overall';

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      try {
        const [profileRes, badgesRes, historyRes] = await Promise.all([
          profileAPI.get(user.username),
          badgesAPI.getAll(),
          profileAPI.scoreHistory(user.username),
        ]);
        setProfile(profileRes.data.profile);
        setAllBadges(badgesRes.data.badges || []);
        setScoreHistory(historyRes.data.history || {});
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
      <div className="bg-card border border-accent/20 rounded-lg p-8">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-3xl flex-shrink-0" style={{ fontFamily: 'var(--font-display)' }}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full rounded-full object-cover" />
            ) : (
              profile.username.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                {profile.username}
              </h2>
              {profile.is_self && (
                <Link href="/dashboard/settings" className="text-muted-dark hover:text-white">
                  <Settings size={18} />
                </Link>
              )}
            </div>

            {/* Score + Tier */}
            {overallScore?.is_unlocked ? (
              <div className="flex items-center gap-4 mb-4">
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

            {/* Stats Row */}
            <div className="flex items-center gap-6 text-sm">
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

      {/* Badges */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm uppercase tracking-wider text-muted-dark font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Badges ({earnedBadges.length}/{allBadges.length})
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
              <div className="text-2xl mb-1">{badge.icon}</div>
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
    </div>
  );
}
