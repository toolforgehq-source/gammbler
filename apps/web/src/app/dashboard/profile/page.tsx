'use client';

import { useEffect, useState } from 'react';
import { profileAPI, badgesAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Settings, Award, Calendar, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      try {
        const [profileRes, badgesRes] = await Promise.all([
          profileAPI.get(user.username),
          badgesAPI.getAll(),
        ]);
        setProfile(profileRes.data.profile);
        setAllBadges(badgesRes.data.badges || []);
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

        <div className="flex items-center gap-2 mt-4 text-xs text-muted-dark">
          <Calendar size={12} />
          Member since {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
      </div>

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
