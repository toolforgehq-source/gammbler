'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notificationsAPI } from '@/lib/api';
import {
  Bell, Check, Target, UserPlus, TrendingUp, Trophy, PenLine, Swords, Award,
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  data: Record<string, unknown>;
  created_at: string;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  challenge_received: Target,
  challenge_accepted: Target,
  challenge_settled: Target,
  new_follower: UserPlus,
  score_change: TrendingUp,
  rank_milestone: Trophy,
  leaderboard_passed: Trophy,
  creator_post: PenLine,
  league_invite: Swords,
  badge_earned: Award,
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = (now.getTime() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationsAPI.list()
      .then((res) => setNotifications(res.data.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // ignore
    }
  };

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      try {
        await notificationsAPI.markRead(n.id);
        setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, read: true } : item));
      } catch {
        // ignore
      }
    }

    const url = n.data?.url as string | undefined;
    if (url) {
      router.push(url);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
          Notifications
        </h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs text-accent hover:text-accent-light flex items-center gap-1">
            <Check size={14} /> Mark all read
          </button>
        )}
      </div>

      {unreadCount > 0 && (
        <p className="text-sm text-muted-dark">{unreadCount} unread</p>
      )}

      {notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell size={48} className="text-muted-dark mx-auto mb-4" />
          <p className="text-muted-dark">No notifications yet.</p>
          <p className="text-xs text-muted-dark mt-2">You&apos;ll be notified about challenges, score milestones, and more.</p>
        </div>
      ) : (
        notifications.map((n) => {
          const Icon = TYPE_ICONS[n.type] || Bell;
          return (
            <div
              key={n.id}
              onClick={() => handleClick(n)}
              className={`bg-card border rounded-lg p-4 cursor-pointer transition-colors ${
                n.read ? 'border-accent/10 opacity-60' : 'border-accent/30 hover:border-accent/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex-shrink-0 ${n.read ? 'text-muted-dark' : 'text-accent'}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{n.title}</p>
                  <p className="text-xs text-muted-dark mt-1">{n.body}</p>
                  <p className="text-xs text-muted-dark mt-2">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
