'use client';

import { useEffect, useState } from 'react';
import { creatorPostsAPI, cappersAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Heart, MessageCircle, Send, Lock, Image, PenLine, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface CreatorPost {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  content: string | null;
  content_preview: string | null;
  image_url: string | null;
  is_subscriber_only: boolean;
  is_unlocked: boolean;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  created_at: string;
}

interface Comment {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  text: string;
  created_at: string;
}

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

function CommentSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    creatorPostsAPI.getComments(postId).then((res) => {
      setComments(res.data.comments || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [postId]);

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await creatorPostsAPI.addComment(postId, text.trim());
      setComments((prev) => [...prev, res.data.comment]);
      setText('');
    } catch { /* ignore */ }
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

export default function CreatorFeedPage() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<CreatorPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCapper, setIsCapper] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isSubscriberOnly, setIsSubscriberOnly] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await creatorPostsAPI.list();
        if (!cancelled) setPosts(res.data.posts || []);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    cappersAPI.myEarnings().then(() => { if (!cancelled) setIsCapper(true); }).catch(() => { if (!cancelled) setIsCapper(false); });
    return () => { cancelled = true; };
  }, []);

  async function handlePublish() {
    if (!newContent.trim() || publishing) return;
    setPublishing(true);
    try {
      const res = await creatorPostsAPI.create({
        content: newContent.trim(),
        image_url: newImageUrl.trim() || undefined,
        is_subscriber_only: isSubscriberOnly,
      });
      if (res.data.post) {
        setPosts((prev) => [res.data.post, ...prev]);
      }
      setNewContent('');
      setNewImageUrl('');
      setIsSubscriberOnly(false);
      setShowCompose(false);
    } catch { /* ignore */ }
    setPublishing(false);
  }

  async function handleLike(postId: string, isLiked: boolean) {
    try {
      if (isLiked) {
        const res = await creatorPostsAPI.unlike(postId);
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_liked: false, like_count: res.data.like_count } : p));
      } else {
        const res = await creatorPostsAPI.like(postId);
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_liked: true, like_count: res.data.like_count } : p));
      }
    } catch { /* ignore */ }
  }

  async function handleDelete(postId: string) {
    if (!confirm('Delete this post?')) return;
    try {
      await creatorPostsAPI.delete(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch { /* ignore */ }
  }

  function toggleComments(postId: string) {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            CREATOR FEED
          </h1>
          <p className="text-muted-dark text-sm mt-1">Posts from cappers you follow</p>
        </div>
        {isCapper && (
          <button
            onClick={() => setShowCompose(!showCompose)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-background rounded-lg font-semibold hover:bg-accent-light transition-colors"
          >
            <PenLine size={16} />
            <span className="hidden sm:inline">New Post</span>
          </button>
        )}
      </div>

      {/* Compose */}
      {showCompose && (
        <div className="bg-card rounded-xl p-4 border border-accent/20">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Share your analysis, picks, or thoughts..."
            maxLength={5000}
            rows={4}
            className="w-full bg-background border border-accent/20 rounded-lg px-4 py-3 text-sm text-white placeholder:text-muted-dark focus:outline-none focus:border-accent/50 resize-none"
          />
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-3">
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Image URL (optional)"
                className="flex-1 bg-background border border-accent/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-muted-dark focus:outline-none focus:border-accent/50"
              />
              <Image size={14} className="text-muted-dark" />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSubscriberOnly}
                  onChange={(e) => setIsSubscriberOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-accent/30 bg-background text-accent focus:ring-accent"
                />
                <Lock size={14} className="text-gold" />
                <span className="text-xs text-muted-dark">Subscribers only</span>
              </label>
              <button
                onClick={handlePublish}
                disabled={!newContent.trim() || publishing}
                className="px-4 py-1.5 bg-accent text-background rounded-lg text-sm font-semibold hover:bg-accent-light transition-colors disabled:opacity-50"
              >
                {publishing ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Posts */}
      {loading ? (
        <div className="text-center py-12 text-muted-dark">Loading...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <PenLine size={48} className="mx-auto text-muted-dark/50 mb-4" />
          <p className="text-muted-dark">No posts yet. Follow some cappers to see their content here!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-card rounded-xl p-4 border border-accent/10">
              {/* Post Header */}
              <div className="flex items-center gap-3 mb-3">
                <Link href={`/dashboard/profile/${post.username}`}>
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">
                    {post.avatar_url ? (
                      <img src={post.avatar_url} alt={post.username} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      post.username.charAt(0).toUpperCase()
                    )}
                  </div>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/dashboard/profile/${post.username}`} className="font-semibold text-white hover:text-accent text-sm">
                    {post.username}
                  </Link>
                  <p className="text-[11px] text-muted-dark">{timeAgo(post.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {post.is_subscriber_only && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gold/20 text-gold">
                      <Lock size={10} />
                      SUBSCRIBERS
                    </span>
                  )}
                  {post.user_id === user?.id && (
                    <button onClick={() => handleDelete(post.id)} className="text-muted-dark hover:text-loss transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Post Content */}
              {post.is_unlocked ? (
                <div>
                  <p className="text-sm text-white/90 whitespace-pre-wrap">{post.content}</p>
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="Post image"
                      className="mt-3 rounded-lg max-h-96 w-full object-cover border border-accent/10"
                    />
                  )}
                </div>
              ) : (
                <div className="relative">
                  <p className="text-sm text-white/40 blur-sm select-none">{post.content_preview}</p>
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 rounded-lg">
                    <Lock size={24} className="text-gold mb-2" />
                    <p className="text-xs text-gold font-semibold">Subscriber-Only Content</p>
                    <Link
                      href={`/dashboard/cappers`}
                      className="mt-2 px-3 py-1 bg-gold/20 text-gold text-xs font-semibold rounded-full hover:bg-gold/30 transition-colors"
                    >
                      Subscribe to Unlock
                    </Link>
                  </div>
                </div>
              )}

              {/* Post Actions */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-accent/10">
                <button
                  onClick={() => handleLike(post.id, post.is_liked)}
                  className={`flex items-center gap-1.5 text-xs transition-colors ${
                    post.is_liked ? 'text-loss' : 'text-muted-dark hover:text-loss'
                  }`}
                >
                  <Heart size={16} fill={post.is_liked ? 'currentColor' : 'none'} />
                  <span>{post.like_count || ''}</span>
                </button>
                <button
                  onClick={() => toggleComments(post.id)}
                  className="flex items-center gap-1.5 text-xs text-muted-dark hover:text-accent transition-colors"
                >
                  <MessageCircle size={16} />
                  <span>{post.comment_count || ''}</span>
                </button>
              </div>

              {/* Comments */}
              {expandedComments.has(post.id) && <CommentSection postId={post.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
