import { Router, Request, Response } from 'express';
import { db } from '../db';
import { feedEvents, feedLikes, feedComments, follows, users, gammblerScores } from '../db/schema';
import { eq, and, desc, inArray, sql, or } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { attachTier } from '../middleware/subscription';
import { z } from 'zod';

const router = Router();

// GET /feed — get community feed
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    // Get followed users
    const following = await db
      .select({ following_id: follows.following_id })
      .from(follows)
      .where(eq(follows.follower_id, userId));
    const followedIds = following.map((f) => f.following_id);

    // Get top 100 national ranked users
    const topUsers = await db
      .select({ user_id: gammblerScores.user_id })
      .from(gammblerScores)
      .where(
        and(
          eq(gammblerScores.sport, 'overall' as any),
          eq(gammblerScores.is_unlocked, true)
        )
      )
      .orderBy(desc(gammblerScores.score))
      .limit(100);
    const topUserIds = topUsers.map((u) => u.user_id);

    // Combine and deduplicate
    const allRelevantIds = [...new Set([...followedIds, ...topUserIds, userId])];

    if (allRelevantIds.length === 0) {
      res.json({ feed: [], limit, offset });
      return;
    }

    const events = await db
      .select({
        id: feedEvents.id,
        user_id: feedEvents.user_id,
        username: users.username,
        avatar_url: users.avatar_url,
        event_type: feedEvents.event_type,
        event_data: feedEvents.event_data,
        sport: feedEvents.sport,
        created_at: feedEvents.created_at,
      })
      .from(feedEvents)
      .innerJoin(users, eq(users.id, feedEvents.user_id))
      .where(inArray(feedEvents.user_id, allRelevantIds))
      .orderBy(desc(feedEvents.created_at))
      .limit(limit)
      .offset(offset);

    // Get like counts and user's like status for these events
    const eventIds = events.map((e) => e.id);

    let likeCounts: Record<string, number> = {};
    let userLikes: Set<string> = new Set();
    let commentCounts: Record<string, number> = {};

    if (eventIds.length > 0) {
      const likeRows = await db
        .select({
          event_id: feedLikes.event_id,
          count: sql<number>`count(*)::int`,
        })
        .from(feedLikes)
        .where(inArray(feedLikes.event_id, eventIds))
        .groupBy(feedLikes.event_id);

      for (const r of likeRows) {
        likeCounts[r.event_id] = r.count;
      }

      const myLikes = await db
        .select({ event_id: feedLikes.event_id })
        .from(feedLikes)
        .where(and(inArray(feedLikes.event_id, eventIds), eq(feedLikes.user_id, userId)));

      for (const r of myLikes) {
        userLikes.add(r.event_id);
      }

      const commentRows = await db
        .select({
          event_id: feedComments.event_id,
          count: sql<number>`count(*)::int`,
        })
        .from(feedComments)
        .where(inArray(feedComments.event_id, eventIds))
        .groupBy(feedComments.event_id);

      for (const r of commentRows) {
        commentCounts[r.event_id] = r.count;
      }
    }

    // Format feed items with human-readable text
    const feed = events.map((e) => ({
      ...e,
      display_text: formatFeedEvent(e.username, e.event_type, e.event_data as Record<string, any>, e.sport),
      like_count: likeCounts[e.id] || 0,
      is_liked: userLikes.has(e.id),
      comment_count: commentCounts[e.id] || 0,
    }));

    res.json({ feed, limit, offset });
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /feed/:eventId/like — like a feed event
router.post('/:eventId/like', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.insert(feedLikes).values({
      event_id: req.params.eventId,
      user_id: req.user!.userId,
    }).onConflictDoNothing();

    const [count] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedLikes)
      .where(eq(feedLikes.event_id, req.params.eventId));

    res.json({ liked: true, like_count: count?.count || 0 });
  } catch (err) {
    console.error('Like error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /feed/:eventId/like — unlike a feed event
router.delete('/:eventId/like', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.delete(feedLikes).where(
      and(
        eq(feedLikes.event_id, req.params.eventId),
        eq(feedLikes.user_id, req.user!.userId)
      )
    );

    const [count] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(feedLikes)
      .where(eq(feedLikes.event_id, req.params.eventId));

    res.json({ liked: false, like_count: count?.count || 0 });
  } catch (err) {
    console.error('Unlike error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /feed/:eventId/comments — get comments for a feed event
router.get('/:eventId/comments', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const comments = await db
      .select({
        id: feedComments.id,
        user_id: feedComments.user_id,
        username: users.username,
        avatar_url: users.avatar_url,
        text: feedComments.text,
        created_at: feedComments.created_at,
      })
      .from(feedComments)
      .innerJoin(users, eq(users.id, feedComments.user_id))
      .where(eq(feedComments.event_id, req.params.eventId))
      .orderBy(feedComments.created_at)
      .limit(50);

    res.json({ comments });
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const commentSchema = z.object({
  text: z.string().min(1).max(500),
});

// POST /feed/:eventId/comments — add a comment to a feed event
router.post('/:eventId/comments', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Comment must be 1-500 characters' });
      return;
    }

    const [comment] = await db.insert(feedComments).values({
      event_id: req.params.eventId,
      user_id: req.user!.userId,
      text: parsed.data.text,
    }).returning();

    const [user] = await db
      .select({ username: users.username, avatar_url: users.avatar_url })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    res.status(201).json({
      comment: {
        ...comment,
        username: user?.username,
        avatar_url: user?.avatar_url,
      },
    });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function formatFeedEvent(
  username: string,
  eventType: string,
  data: Record<string, any>,
  sport: string | null
): string {
  switch (eventType) {
    case 'parlay_hit':
      return `${username} just hit a ${data.legs} leg parlay`;
    case 'rank_up':
      return `${username} moved up to #${data.new_rank ?? data.rank} in ${(sport || 'Overall').toUpperCase()} rankings`;
    case 'win_streak':
      return `${username} is on a ${data.streak} bet winning streak`;
    case 'badge_earned':
      return `${username} just earned the ${formatBadgeName(data.badge)} badge`;
    case 'score_high':
      return `${username}'s Gammbler Score hit an all-time high of ${data.score}`;
    case 'sportsbook_connected':
      return `${username} just connected their ${formatPlatformName(data.platform)} account`;
    case 'weekly_leader':
      return `New week, new leaderboard. ${username} is currently #1 among your friends`;
    case 'h2h_challenge':
      return `${username} challenged @${data.challengee_username || 'someone'} on ${data.event_name || 'a game'}`;
    case 'h2h_result':
      return `${username} won a head-to-head vs @${data.loser_username || 'opponent'} on ${data.event_name || 'a game'}`;
    default:
      return `${username} had activity on Gammbler`;
  }
}

function formatBadgeName(badge: string): string {
  return badge
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatPlatformName(platform: string): string {
  const names: Record<string, string> = {
    draftkings: 'DraftKings',
    fanduel: 'FanDuel',
    betmgm: 'BetMGM',
    caesars: 'Caesars',
    espn_bet: 'ESPN Bet',
    pointsbet: 'PointsBet',
    wynnbet: 'WynnBet',
    prizepicks: 'PrizePicks',
    underdog: 'Underdog',
  };
  return names[platform] || platform;
}

export default router;
