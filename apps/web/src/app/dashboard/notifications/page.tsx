'use client';

import { useEffect, useState } from 'react';
import { notificationsAPI } from '@/lib/api';
import { Bell, Check } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  data: Record<string, unknown>;
  created_at: string;
}

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

  const markRead = async (id: string) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    } catch {
      // ignore
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
      {unreadCount > 0 && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-dark">{unreadCount} unread</p>
          <button onClick={markAllRead} className="text-xs text-accent hover:text-accent-light flex items-center gap-1">
            <Check size={14} /> Mark all read
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell size={48} className="text-muted-dark mx-auto mb-4" />
          <p className="text-muted-dark">No notifications yet.</p>
        </div>
      ) : (
        notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => !n.read && markRead(n.id)}
            className={`bg-card border rounded-lg p-4 cursor-pointer transition-colors ${
              n.read ? 'border-accent/10 opacity-60' : 'border-accent/30 hover:border-accent/50'
            }`}
          >
            <div className="flex items-start gap-3">
              {!n.read && <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />}
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{n.title}</p>
                <p className="text-xs text-muted-dark mt-1">{n.body}</p>
                <p className="text-xs text-muted-dark mt-2">{timeAgo(n.created_at)}</p>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
