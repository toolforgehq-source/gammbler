'use client';

import { useEffect, useState, useCallback } from 'react';
import { feedAPI } from '@/lib/api';
import {
  Flame, TrendingUp, Zap, Award, BarChart3, Link2, Trophy, Target, Swords,
  Heart, MessageCircle, Send, Repeat2, Image as ImageIcon, Smile
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

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
  repost_count: number;
  is_reposted: boolean;
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
  user_post: MessageCircle,
  repost: Repeat2,
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = (now.getTime() - date.getTime()) / 1000;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    <div className="mt-3 pt-3 border-t border-white/5">
      {loading ? (
        <div className="text-xs text-muted-dark py-2">Loading...</div>
      ) : (
        <>
          {comments.length > 0 && (
            <div className="space-y-3 mb-3">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <Link href={`/dashboard/profile/${c.username}`}>
                    <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-[10px] flex-shrink-0 overflow-hidden">
                      {c.avatar_url ? (
                        <img src={c.avatar_url} alt={c.username} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        c.username.charAt(0).toUpperCase()
                      )}
                    </div>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/dashboard/profile/${c.username}`} className="text-xs font-bold text-white hover:text-accent transition-colors">
                        {c.username}
                      </Link>
                      <span className="text-[10px] text-muted-dark">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-xs text-white/80 mt-0.5 leading-relaxed">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Reply..."
              maxLength={500}
              className="flex-1 bg-transparent border border-white/10 rounded-full px-4 py-2 text-xs text-white placeholder:text-muted-dark focus:outline-none focus:border-accent/50 transition-colors"
            />
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || submitting}
              className="p-2 text-accent hover:text-accent-light disabled:opacity-30 transition-colors rounded-full hover:bg-accent/10"
            >
              <Send size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ComposeBox({ onPost }: { onPost: (post: FeedItem) => void }) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const maxLength = 2000;

  const handlePost = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await feedAPI.createPost(content.trim());
      onPost(res.data.post);
      setContent('');
      setFocused(false);
    } catch {
      // ignore
    }
    setSubmitting(false);
  };

  return (
    <div className="bg-card border border-white/10 rounded-2xl p-4 mb-4">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">
          <Smile size={18} />
        </div>
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="What's happening in the betting world?"
            maxLength={maxLength}
            rows={focused ? 3 : 1}
            className="w-full bg-transparent text-white text-sm placeholder:text-muted-dark resize-none focus:outline-none leading-relaxed py-2"
          />
          {focused && (
            <div className="flex items-center justify-between pt-3 border-t border-white/5">
              <div className="flex items-center gap-2">
                <button className="p-2 text-accent/60 hover:text-accent hover:bg-accent/10 rounded-full transition-colors">
                  <ImageIcon size={16} />
                </button>
              </div>
              <div className="flex items-center gap-3">
                {content.length > 0 && (
                  <span className={`text-xs ${content.length > maxLength * 0.9 ? 'text-red-400' : 'text-muted-dark'}`}>
                    {content.length}/{maxLength}
                  </span>
                )}
                <button
                  onClick={handlePost}
                  disabled={!content.trim() || submitting}
                  className="px-4 py-1.5 bg-accent text-background text-xs font-bold rounded-full hover:bg-accent-light disabled:opacity-40 transition-all"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {submitting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedCard({
  item,
  onLike,
  onRepost,
  onToggleComments,
  commentsExpanded,
}: {
  item: FeedItem;
  onLike: (id: string, isLiked: boolean) => void;
  onRepost: (id: string, isReposted: boolean) => void;
  onToggleComments: (id: string) => void;
  commentsExpanded: boolean;
}) {
  const isUserPost = item.event_type === 'user_post';
  const isRepost = item.event_type === 'repost';
  const eventData = item.event_data as Record<string, unknown>;

  // For reposts, show the original content
  const originalEventData = (eventData?.original_event_data || {}) as Record<string, unknown>;
  const displayContent = isRepost
    ? (originalEventData?.content as string) || ''
    : isUserPost
      ? (eventData?.content as string) || item.display_text
      : item.display_text;

  const originalUsername = isRepost ? (eventData?.original_username as string) : null;

  return (
    <div className="bg-card border border-white/5 rounded-2xl p-4 hover:border-white/10 transition-all group">
      {/* Repost header */}
      {isRepost && (
        <div className="flex items-center gap-2 mb-2 ml-12">
          <Repeat2 size={12} className="text-accent" />
          <span className="text-xs text-muted-dark">
            <Link href={`/dashboard/profile/${item.username}`} className="text-accent hover:text-accent-light font-medium">
              {item.username}
            </Link>
            {' '}reposted
          </span>
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Link href={`/dashboard/profile/${isRepost ? originalUsername || item.username : item.username}`}>
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0 overflow-hidden hover:ring-2 hover:ring-accent/30 transition-all">
            {item.avatar_url ? (
              <img src={item.avatar_url} alt={item.username} className="w-full h-full rounded-full object-cover" />
            ) : (
              (isRepost ? originalUsername || item.username : item.username).charAt(0).toUpperCase()
            )}
          </div>
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/profile/${isRepost ? originalUsername || item.username : item.username}`}
              className="font-bold text-sm text-white hover:text-accent transition-colors"
            >
              {isRepost ? originalUsername || item.username : item.username}
            </Link>
            <span className="text-xs text-muted-dark">·</span>
            <span className="text-xs text-muted-dark">{timeAgo(item.created_at)}</span>
            {item.sport && !isUserPost && (
              <>
                <span className="text-xs text-muted-dark">·</span>
                <span className="text-[10px] uppercase tracking-wider text-accent/70 font-medium bg-accent/5 px-1.5 py-0.5 rounded" style={{ fontFamily: 'var(--font-display)' }}>
                  {item.sport}
                </span>
              </>
            )}
          </div>

          {/* Post body */}
          <div className="mt-1">
            {isUserPost || isRepost ? (
              <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{displayContent}</p>
            ) : (
              <p className="text-sm text-white/90 leading-relaxed">
                {item.display_text.replace(item.username, '').trim()}{' '}
                {item.event_type === 'badge_earned' && eventData?.badge_type ? (
                  <Image
                    src={`/badges/${eventData.badge_type as string}.png`}
                    alt={(eventData.badge_name as string) || 'Badge'}
                    width={20}
                    height={20}
                    className="inline-block object-contain align-text-bottom"
                    unoptimized
                  />
                ) : null}
              </p>
            )}

            {/* Image attachment */}
            {eventData?.image_url && (
              <div className="mt-3 rounded-xl overflow-hidden border border-white/10">
                <img
                  src={eventData.image_url as string}
                  alt="Post attachment"
                  className="w-full max-h-96 object-cover"
                />
              </div>
            )}
          </div>

          {/* Action buttons — Twitter-style */}
          <div className="flex items-center justify-between mt-3 max-w-[360px]">
            {/* Comments */}
            <button
              onClick={() => onToggleComments(item.id)}
              className="flex items-center gap-1.5 text-muted-dark hover:text-accent group/btn transition-colors"
            >
              <div className="p-1.5 rounded-full group-hover/btn:bg-accent/10 transition-colors">
                <MessageCircle size={15} />
              </div>
              {item.comment_count > 0 && <span className="text-xs">{item.comment_count}</span>}
            </button>

            {/* Repost */}
            <button
              onClick={() => onRepost(item.id, item.is_reposted)}
              className={`flex items-center gap-1.5 transition-colors ${
                item.is_reposted ? 'text-green-500' : 'text-muted-dark hover:text-green-500'
              } group/btn`}
            >
              <div className={`p-1.5 rounded-full group-hover/btn:bg-green-500/10 transition-colors`}>
                <Repeat2 size={15} />
              </div>
              {item.repost_count > 0 && <span className="text-xs">{item.repost_count}</span>}
            </button>

            {/* Like */}
            <button
              onClick={() => onLike(item.id, item.is_liked)}
              className={`flex items-center gap-1.5 transition-colors ${
                item.is_liked ? 'text-red-500' : 'text-muted-dark hover:text-red-500'
              } group/btn`}
            >
              <div className={`p-1.5 rounded-full group-hover/btn:bg-red-500/10 transition-colors`}>
                <Heart size={15} fill={item.is_liked ? 'currentColor' : 'none'} />
              </div>
              {item.like_count > 0 && <span className="text-xs">{item.like_count}</span>}
            </button>
          </div>

          {/* Comments section */}
          {commentsExpanded && <CommentSection eventId={item.id} />}
        </div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'foryou' | 'following'>('foryou');

  const fetchFeed = useCallback(async (newOffset: number, tab: 'foryou' | 'following') => {
    try {
      const params = { limit: '30', offset: String(newOffset) };
      const res = tab === 'following'
        ? await feedAPI.getFollowing(params)
        : await feedAPI.get(params);
      const items = res.data.feed || [];
      if (newOffset === 0) {
        setFeed(items);
      } else {
        setFeed((prev) => [...prev, ...items]);
      }
      setHasMore(items.length === 30);
    } catch {
      if (newOffset === 0) setFeed([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = () => {
      setLoading(true);
      setOffset(0);
      fetchFeed(0, activeTab);
    };
    load();
  }, [activeTab, fetchFeed]);

  useEffect(() => {
    const interval = setInterval(() => fetchFeed(0, activeTab), 60000);
    return () => clearInterval(interval);
  }, [activeTab, fetchFeed]);

  const loadMore = () => {
    const newOffset = offset + 30;
    setOffset(newOffset);
    fetchFeed(newOffset, activeTab);
  };

  const handleNewPost = (post: FeedItem) => {
    setFeed((prev) => [post, ...prev]);
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

  const handleRepost = async (eventId: string, isReposted: boolean) => {
    try {
      const res = isReposted
        ? await feedAPI.unrepost(eventId)
        : await feedAPI.repost(eventId);
      setFeed((prev) =>
        prev.map((item) =>
          item.id === eventId
            ? { ...item, is_reposted: res.data.reposted, repost_count: res.data.repost_count }
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

  return (
    <div className="max-w-2xl mx-auto">
      {/* Tab header — sticky like Twitter */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-white/5 mb-4 -mx-4 px-4">
        <div className="flex">
          <button
            onClick={() => setActiveTab('foryou')}
            className={`flex-1 py-3.5 text-sm font-bold text-center relative transition-colors ${
              activeTab === 'foryou' ? 'text-white' : 'text-muted-dark hover:text-white/70'
            }`}
          >
            For You
            {activeTab === 'foryou' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-accent rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('following')}
            className={`flex-1 py-3.5 text-sm font-bold text-center relative transition-colors ${
              activeTab === 'following' ? 'text-white' : 'text-muted-dark hover:text-white/70'
            }`}
          >
            Following
            {activeTab === 'following' && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-accent rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Compose box */}
      <ComposeBox onPost={handleNewPost} />

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : feed.length === 0 ? (
        <div className="text-center py-16">
          <Zap size={40} className="text-accent/40 mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2 text-white" style={{ fontFamily: 'var(--font-display)' }}>
            {activeTab === 'following' ? 'Follow bettors to see their posts' : 'Your feed is empty'}
          </h2>
          <p className="text-sm text-muted-dark max-w-xs mx-auto">
            {activeTab === 'following'
              ? 'When you follow other bettors, their posts and activity will show up here.'
              : 'Start posting or follow other bettors to see activity in your feed.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {feed.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              onLike={handleLike}
              onRepost={handleRepost}
              onToggleComments={toggleComments}
              commentsExpanded={expandedComments.has(item.id)}
            />
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full py-4 text-sm text-accent hover:text-accent-light font-medium transition-colors"
            >
              Show more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
