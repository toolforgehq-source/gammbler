'use client';

import { useEffect, useState } from 'react';
import { badgesAPI } from '@/lib/api';
import Image from 'next/image';

interface Badge {
  badge_type: string;
  name: string;
  description: string;
  image: string;
  category: string;
  earned: boolean;
  earned_at: string | null;
}

interface BadgeCategory {
  id: string;
  label: string;
  badges: Badge[];
}

function BadgeImage({ badge, size = 80, earned = true }: { badge: Badge; size?: number; earned?: boolean }) {
  const src = badge.image || `/badges/${badge.badge_type}.png`;
  return (
    <div className={`relative mx-auto mb-3 ${earned ? '' : 'grayscale opacity-50'}`} style={{ width: size, height: size }}>
      <Image
        src={src}
        alt={badge.name}
        width={size}
        height={size}
        className="object-contain drop-shadow-lg"
        unoptimized
      />
    </div>
  );
}

const CATEGORY_ICONS: Record<string, string> = {
  betting: '🎰',
  dfs: '🎮',
  creator: '🎬',
  tier: '🏆',
  capper: '🛡️',
};

export default function AchievementsPage() {
  const [categories, setCategories] = useState<BadgeCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [earned, setEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');

  useEffect(() => {
    badgesAPI.getAllCategories()
      .then((res) => {
        setCategories(res.data.categories || []);
        setTotal(res.data.total || 0);
        setEarned(res.data.earned || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [{ id: 'all', label: 'All' }, ...categories.map((c) => ({ id: c.id, label: c.label }))];
  const visibleCategories = activeTab === 'all' ? categories : categories.filter((c) => c.id === activeTab);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <p className="text-5xl font-bold text-accent mb-2" style={{ fontFamily: 'var(--font-number)' }}>
          {earned}/{total}
        </p>
        <p className="text-sm text-muted-dark uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
          Badges Earned
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 justify-center">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-accent text-white'
                : 'bg-card border border-accent/20 text-muted-dark hover:border-accent/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Badge Categories */}
      {visibleCategories.map((category) => {
        const categoryEarned = category.badges.filter((b) => b.earned);
        const categoryLocked = category.badges.filter((b) => !b.earned);

        return (
          <div key={category.id} className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">{CATEGORY_ICONS[category.id] || '🏅'}</span>
              <h2 className="text-sm uppercase tracking-wider text-muted-dark font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                {category.label}
              </h2>
              <span className="text-xs text-accent ml-auto" style={{ fontFamily: 'var(--font-number)' }}>
                {categoryEarned.length}/{category.badges.length}
              </span>
            </div>

            {categoryEarned.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {categoryEarned.map((badge) => (
                  <div key={badge.badge_type} className="bg-card border border-gold/40 rounded-lg p-5 text-center hover:border-gold/60 transition-colors group">
                    <BadgeImage badge={badge} size={80} earned />
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
            )}

            {categoryLocked.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {categoryLocked.map((badge) => (
                  <div key={badge.badge_type} className="bg-card border border-accent/10 rounded-lg p-5 text-center">
                    <BadgeImage badge={badge} size={80} earned={false} />
                    <p className="text-sm font-bold text-white/40 mb-1">{badge.name}</p>
                    <p className="text-xs text-muted-dark/60">{badge.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
