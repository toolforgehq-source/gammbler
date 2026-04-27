'use client';

import { useEffect, useState } from 'react';
import { badgesAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import UpgradeBanner from '@/components/ui/UpgradeBanner';

interface Badge {
  badge_type: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earned_at: string | null;
}

export default function AchievementsPage() {
  const { user } = useAuthStore();
  const isFree = user?.tier === 'free' || (!user?.tier && user?.subscription_status !== 'active' && user?.subscription_status !== 'trialing');
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    badgesAPI.getAll()
      .then((res) => setBadges(res.data.badges || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const earned = badges.filter((b) => b.earned);
  const unearned = badges.filter((b) => !b.earned);

  if (isFree) {
    return (
      <div className="max-w-4xl mx-auto">
        <UpgradeBanner feature="Achievement Badges" description="Earn 20+ unique badges as you hit milestones — from your first win to Legend status. Track your progress and show off your accomplishments." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <p className="text-5xl font-bold text-accent mb-2" style={{ fontFamily: 'var(--font-number)' }}>
          {earned.length}/{badges.length}
        </p>
        <p className="text-sm text-muted-dark uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
          Badges Earned
        </p>
      </div>

      {earned.length > 0 && (
        <div>
          <h2 className="text-sm uppercase tracking-wider text-muted-dark mb-4 font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Earned
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {earned.map((badge) => (
              <div key={badge.badge_type} className="bg-card border border-gold/40 rounded-lg p-5 text-center">
                <div className="text-4xl mb-2">{badge.icon}</div>
                <p className="text-sm font-bold text-white mb-1">{badge.name}</p>
                <p className="text-xs text-muted-dark mb-2">{badge.description}</p>
                {badge.earned_at && (
                  <p className="text-xs text-accent">
                    Earned {new Date(badge.earned_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {unearned.length > 0 && (
        <div>
          <h2 className="text-sm uppercase tracking-wider text-muted-dark mb-4 font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            Locked
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {unearned.map((badge) => (
              <div key={badge.badge_type} className="bg-card border border-accent/10 rounded-lg p-5 text-center opacity-40">
                <div className="text-4xl mb-2 grayscale">{badge.icon}</div>
                <p className="text-sm font-bold text-white mb-1">{badge.name}</p>
                <p className="text-xs text-muted-dark">{badge.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
