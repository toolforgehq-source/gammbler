'use client';

import { useEffect, useState, useCallback } from 'react';
import { feedAPI } from '@/lib/api';
import { Flame, TrendingUp, Zap, Award, BarChart3, Link2, Trophy, Target, Swords, Heart, MessageCircle, Send } from 'lucide-react';
import Link from 'next/link';

interface FeedItem {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  event_type: string;
  event_data: Record<string, unknown>;
  sport: string | null;
  created_at: string;
  display_text: string;
  like_count: number;
  is_liked: boolean;
  comment_count: number;
}

interface Comment {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  text: string;
  created_at: string;
}

const EVENT_ICONS: Record<string, typeof Flame> = {
  parlay_hit: Flame,
  rank_up: TrendingUp,
  win_streak: Zap,
  badge_earned: Award,
  score_high: BarChart3,
  sportsbook_connected: Link2,
  weekly_leader: Trophy,
  h2h_challenge: Target,
  h2h_result: Swords,
};

const EVENT_EMOJIS: Record<string, string> = {
  parlay_hit: '🔥',
  rank_up: '📈',
  win_streak: '⚡',
  badge_earned: '🏆',
  score_high: '📊',
  sportsbook_connected: '🔗',
  weekly_leader: '👑',
  h2h_challenge: '🎯',
  h2h_result: '⚔️',
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = (now.getTime() - date.getTime()) / 1000;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

function CommentSection({ eventId }: { eventId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    feedAPI.getComments(eventId).then((res) => {
      setComments(res.data.comments || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [eventId]);

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await feedAPI.addComment(eventId, text.trim());
      setComments((prev) => [...prev, res.data.comment]);
      setText('');
    } catch {
      // ignore
    }
    setSubmitting(false);
  };

  return (
    <div className="mt-3 pt-3 border-t border-accent/10">
      {loading ? (
        <div className="text-xs text-muted-dark py-2">Loading...</div>
      ) : (
        <>
          {comments.length > 0 && (
            <div className="space-y-2 mb-3">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2">
                  <Link href={`/dashboard/profile/${c.username}`}>
                    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-[10px] flex-shrink-0">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt={c.username} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        c.username.charAt(0).toUpperCase()
                      )}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs">
                      <Link href={`/dashboard/profile/${c.username}`} className="font-semibold text-accent hover:text-accent-light">
                        {c.username}
                      </Link>{' '}
                      <span className="text-white/80">{c.text}</span>
                    </p>
                    <p className="text-[10px] text-muted-dark mt-0.5">{timeAgo(c.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Add a comment..."
              maxLength={500}
              className="flex-1 bg-background border border-accent/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-muted-dark focus:outline-none focus:border-accent/50"
            />
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || submitting}
              className="p-1.5 text-accent hover:text-accent-light disabled:opacity-30 transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function FeedPage() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  const fetchFeed = useCallback(async (newOffset: number) => {
    try {
      const res = await feedAPI.get({ limit: '30', offset: String(newOffset) });
      const items = res.data.feed || [];
      if (newOffset === 0) {
        setFeed(items);
      } else {
        setFeed((prev) => [...prev, ...items]);
      }
      setHasMore(items.length === 30);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed(0);
    const interval = setInterval(() => fetchFeed(0), 60000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  const loadMore = () => {
    const newOffset = offset + 30;
    setOffset(newOffset);
    fetchFeed(newOffset);
  };

  const handleLike = async (eventId: string, isLiked: boolean) => {
    try {
      const res = isLiked
        ? await feedAPI.unlike(eventId)
        : await feedAPI.like(eventId);
      setFeed((prev) =>
        prev.map((item) =>
          item.id === eventId
            ? { ...item, is_liked: res.data.liked, like_count: res.data.like_count }
            : item
        )
      );
    } catch {
      // ignore
    }
  };

  const toggleComments = (eventId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (feed.length === 0) {
    return (
      <div className="text-center py-20">
        <Zap size={48} className="text-accent mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Your feed is empty
        </h2>
        <p className="text-muted-dark">Follow other bettors to see their activity here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {feed.map((item) => {
        const Icon = EVENT_ICONS[item.event_type] || Zap;
        const emoji = EVENT_EMOJIS[item.event_type] || '⚡';

        return (
          <div
            key={item.id}
            className="bg-card border border-accent/20 rounded-lg p-4 hover:border-accent/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              <Link href={`/dashboard/profile/${item.username}`}>
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">
                  {item.avatar_url ? (
                    <img src={item.avatar_url} alt={item.username} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    item.username.charAt(0).toUpperCase()
                  )}
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white leading-relaxed">
                  <Link href={`/dashboard/profile/${item.username}`} className="font-semibold text-accent hover:text-accent-light">
                    {item.username}
                  </Link>{' '}
                  {item.display_text.replace(item.username, '').trim()}{' '}
                  <span>{emoji}</span>
                </p>
                <p className="text-xs text-muted-dark mt-1">{timeAgo(item.created_at)}</p>
              </div>
              {item.sport && (
                <span className="text-xs uppercase tracking-wider text-muted-dark bg-background px-2 py-1 rounded" style={{ fontFamily: 'var(--font-display)' }}>
                  {item.sport}
                </span>
              )}
            </div>

            {/* Like & Comment buttons */}
            <div className="flex items-center gap-4 mt-3 pt-2 border-t border-accent/10">
              <button
                onClick={() => handleLike(item.id, item.is_liked)}
                className={`flex items-center gap-1.5 text-xs transition-colors ${
                  item.is_liked ? 'text-red-500' : 'text-muted-dark hover:text-red-400'
                }`}
              >
                <Heart size={14} fill={item.is_liked ? 'currentColor' : 'none'} />
                {item.like_count > 0 && <span>{item.like_count}</span>}
              </button>
              <button
                onClick={() => toggleComments(item.id)}
                className="flex items-center gap-1.5 text-xs text-muted-dark hover:text-accent transition-colors"
              >
                <MessageCircle size={14} />
                {item.comment_count > 0 && <span>{item.comment_count}</span>}
              </button>
            </div>

            {/* Comment section */}
            {expandedComments.has(item.id) && (
              <CommentSection eventId={item.id} />
            )}
          </div>
        );
      })}

      {hasMore && (
        <button
          onClick={loadMore}
          className="w-full py-3 text-sm text-accent hover:text-accent-light transition-colors"
        >
          Load More
        </button>
      )}
    </div>
  );
}
