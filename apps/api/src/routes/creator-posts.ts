import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  creatorPosts, creatorPostLikes, creatorPostComments,
  capperProfiles, capperSubscriptions, users, follows,
} from '../db/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';
import { checkAndAwardCreatorBadges } from '../services/creator-badges';
import { notifyCreatorPost } from '../services/notifications';

const router = Router();

const createPostSchema = z.object({
  content: z.string().min(1).max(5000),
  image_url: z.string().url().optional(),
  is_subscriber_only: z.boolean().default(false),
});

// POST /creator-posts — create a new post (cappers only)
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    // Must be a capper to post
    const [capper] = await db
      .select()
      .from(capperProfiles)
      .where(and(eq(capperProfiles.user_id, userId), eq(capperProfiles.status, 'active')))
      .limit(1);

    if (!capper) {
      res.status(403).json({ error: 'You must be a capper to create posts' });
      return;
    }

    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
      return;
    }

    const [post] = await db.insert(creatorPosts).values({
      user_id: userId,
      content: parsed.data.content,
      image_url: parsed.data.image_url || null,
      is_subscriber_only: parsed.data.is_subscriber_only,
    }).returning();

    const [user] = await db
      .select({ username: users.username, avatar_url: users.avatar_url })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Check creator badges (fire & forget)
    checkAndAwardCreatorBadges(userId).catch(() => {});

    // Notify followers about new post (fire & forget)
    const followerRows = await db
      .select({ follower_id: follows.follower_id })
      .from(follows)
      .where(eq(follows.following_id, userId))
      .limit(500);

    const postPreview = parsed.data.content.substring(0, 80);
    for (const f of followerRows) {
      notifyCreatorPost(
        f.follower_id,
        user?.username || 'A creator',
        postPreview,
        post.id,
      ).catch(() => {});
    }

    res.status(201).json({
      post: {
        ...post,
        username: user?.username,
        avatar_url: user?.avatar_url,
        is_liked: false,
        is_unlocked: true,
      },
    });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /creator-posts — get creator feed (posts from followed cappers + discover)
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const creatorId = req.query.creator_id as string | undefined;

    let posts;

    if (creatorId) {
      // Get posts for a specific creator
      posts = await db
        .select({
          id: creatorPosts.id,
          user_id: creatorPosts.user_id,
          content: creatorPosts.content,
          image_url: creatorPosts.image_url,
          is_subscriber_only: creatorPosts.is_subscriber_only,
          like_count: creatorPosts.like_count,
          comment_count: creatorPosts.comment_count,
          created_at: creatorPosts.created_at,
          username: users.username,
          avatar_url: users.avatar_url,
        })
        .from(creatorPosts)
        .innerJoin(users, eq(users.id, creatorPosts.user_id))
        .where(eq(creatorPosts.user_id, creatorId))
        .orderBy(desc(creatorPosts.created_at))
        .limit(limit)
        .offset(offset);
    } else {
      // Get posts from followed creators + top creators
      const following = await db
        .select({ following_id: follows.following_id })
        .from(follows)
        .where(eq(follows.follower_id, userId));
      const followedIds = following.map((f) => f.following_id);

      // Also get top cappers by subscribers
      const topCappers = await db
        .select({ user_id: capperProfiles.user_id })
        .from(capperProfiles)
        .where(eq(capperProfiles.status, 'active'))
        .orderBy(desc(capperProfiles.total_subscribers))
        .limit(50);
      const topCapperIds = topCappers.map((c) => c.user_id);

      const allIds = [...new Set([...followedIds, ...topCapperIds, userId])];

      if (allIds.length === 0) {
        res.json({ posts: [], limit, offset });
        return;
      }

      posts = await db
        .select({
          id: creatorPosts.id,
          user_id: creatorPosts.user_id,
          content: creatorPosts.content,
          image_url: creatorPosts.image_url,
          is_subscriber_only: creatorPosts.is_subscriber_only,
          like_count: creatorPosts.like_count,
          comment_count: creatorPosts.comment_count,
          created_at: creatorPosts.created_at,
          username: users.username,
          avatar_url: users.avatar_url,
        })
        .from(creatorPosts)
        .innerJoin(users, eq(users.id, creatorPosts.user_id))
        .where(inArray(creatorPosts.user_id, allIds))
        .orderBy(desc(creatorPosts.created_at))
        .limit(limit)
        .offset(offset);
    }

    // Check which subscriber-only posts user has access to
    const subscriberOnlyPosts = posts.filter((p) => p.is_subscriber_only);
    let subscribedToIds: Set<string> = new Set();

    if (subscriberOnlyPosts.length > 0) {
      const creatorIds = [...new Set(subscriberOnlyPosts.map((p) => p.user_id))];
      const subs = await db
        .select({ capper_user_id: capperSubscriptions.capper_user_id })
        .from(capperSubscriptions)
        .where(
          and(
            inArray(capperSubscriptions.capper_user_id, creatorIds),
            eq(capperSubscriptions.subscriber_user_id, userId),
            eq(capperSubscriptions.status, 'active')
          )
        );
      subscribedToIds = new Set(subs.map((s) => s.capper_user_id));
    }

    // Check which posts user has liked
    const postIds = posts.map((p) => p.id);
    let userLikes: Set<string> = new Set();
    if (postIds.length > 0) {
      const likes = await db
        .select({ post_id: creatorPostLikes.post_id })
        .from(creatorPostLikes)
        .where(
          and(
            inArray(creatorPostLikes.post_id, postIds),
            eq(creatorPostLikes.user_id, userId)
          )
        );
      userLikes = new Set(likes.map((l) => l.post_id));
    }

    const formattedPosts = posts.map((p) => {
      const isOwn = p.user_id === userId;
      const isSubscribed = subscribedToIds.has(p.user_id);
      const isUnlocked = !p.is_subscriber_only || isOwn || isSubscribed;

      return {
        id: p.id,
        user_id: p.user_id,
        username: p.username,
        avatar_url: p.avatar_url,
        content: isUnlocked ? p.content : null,
        content_preview: !isUnlocked ? p.content.slice(0, 80) + '...' : null,
        image_url: isUnlocked ? p.image_url : null,
        is_subscriber_only: p.is_subscriber_only,
        is_unlocked: isUnlocked,
        like_count: p.like_count,
        comment_count: p.comment_count,
        is_liked: userLikes.has(p.id),
        created_at: p.created_at,
      };
    });

    res.json({ posts: formattedPosts, limit, offset });
  } catch (err) {
    console.error('Get creator posts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /creator-posts/:postId/like
router.post('/:postId/like', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.insert(creatorPostLikes).values({
      post_id: req.params.postId,
      user_id: req.user!.userId,
    }).onConflictDoNothing();

    await db.update(creatorPosts)
      .set({ like_count: sql`${creatorPosts.like_count} + 1` })
      .where(eq(creatorPosts.id, req.params.postId));

    const [post] = await db
      .select({ like_count: creatorPosts.like_count })
      .from(creatorPosts)
      .where(eq(creatorPosts.id, req.params.postId))
      .limit(1);

    res.json({ liked: true, like_count: post?.like_count || 0 });
  } catch (err) {
    console.error('Like post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /creator-posts/:postId/like
router.delete('/:postId/like', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await db.delete(creatorPostLikes).where(
      and(
        eq(creatorPostLikes.post_id, req.params.postId),
        eq(creatorPostLikes.user_id, req.user!.userId)
      )
    );

    await db.update(creatorPosts)
      .set({ like_count: sql`GREATEST(${creatorPosts.like_count} - 1, 0)` })
      .where(eq(creatorPosts.id, req.params.postId));

    const [post] = await db
      .select({ like_count: creatorPosts.like_count })
      .from(creatorPosts)
      .where(eq(creatorPosts.id, req.params.postId))
      .limit(1);

    res.json({ liked: false, like_count: post?.like_count || 0 });
  } catch (err) {
    console.error('Unlike post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /creator-posts/:postId/comments
router.get('/:postId/comments', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const comments = await db
      .select({
        id: creatorPostComments.id,
        user_id: creatorPostComments.user_id,
        username: users.username,
        avatar_url: users.avatar_url,
        text: creatorPostComments.text,
        created_at: creatorPostComments.created_at,
      })
      .from(creatorPostComments)
      .innerJoin(users, eq(users.id, creatorPostComments.user_id))
      .where(eq(creatorPostComments.post_id, req.params.postId))
      .orderBy(creatorPostComments.created_at)
      .limit(50);

    res.json({ comments });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /creator-posts/:postId/comments
router.post('/:postId/comments', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const text = req.body.text;
    if (!text || text.length < 1 || text.length > 500) {
      res.status(400).json({ error: 'Comment must be 1-500 characters' });
      return;
    }

    const [comment] = await db.insert(creatorPostComments).values({
      post_id: req.params.postId,
      user_id: req.user!.userId,
      text,
    }).returning();

    await db.update(creatorPosts)
      .set({ comment_count: sql`${creatorPosts.comment_count} + 1` })
      .where(eq(creatorPosts.id, req.params.postId));

    const [user] = await db
      .select({ username: users.username, avatar_url: users.avatar_url })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    res.status(201).json({
      comment: { ...comment, username: user?.username, avatar_url: user?.avatar_url },
    });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /creator-posts/:postId — delete own post
router.delete('/:postId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const [post] = await db
      .select()
      .from(creatorPosts)
      .where(
        and(
          eq(creatorPosts.id, req.params.postId),
          eq(creatorPosts.user_id, req.user!.userId)
        )
      )
      .limit(1);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    await db.delete(creatorPosts).where(eq(creatorPosts.id, req.params.postId));
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
