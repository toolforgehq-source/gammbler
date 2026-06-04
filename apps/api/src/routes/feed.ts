import { Router, Request, Response } from 'express';
import { db } from '../db';
import { feedEvents, follows, users, gammblerScores } from '../db/schema';
import { eq, and, desc, inArray, sql, or } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { attachTier } from '../middleware/subscription';

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

    // Format feed items with human-readable text
    const feed = events.map((e) => ({
      ...e,
      display_text: formatFeedEvent(e.username, e.event_type, e.event_data as Record<string, any>, e.sport),
    }));

    res.json({ feed, limit, offset });
  } catch (err) {
    console.error('Feed error:', err);
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
