import { Router, Request, Response } from 'express';
import { db } from '../db';
import { gammblerScores, follows, users, capperProfiles } from '../db/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { requirePro, attachTier } from '../middleware/subscription';

const router = Router();

// GET /leaderboards/:sport/friends — PRO ONLY
router.get('/:sport/friends', authMiddleware, requirePro, async (req: Request, res: Response): Promise<void> => {
  try {
    const sport = req.params.sport;
    const userId = req.user!.userId;

    // Get list of users this person follows
    const following = await db
      .select({ following_id: follows.following_id })
      .from(follows)
      .where(eq(follows.follower_id, userId));

    const friendIds = following.map((f) => f.following_id);
    friendIds.push(userId); // Include self

    if (friendIds.length === 0) {
      res.json({ leaderboard: [], user_position: null });
      return;
    }

    // Get scores for all friends in this sport
    const scores = await db
      .select({
        user_id: gammblerScores.user_id,
        username: users.username,
        avatar_url: users.avatar_url,
        score: gammblerScores.score,
        is_unlocked: gammblerScores.is_unlocked,
        settled_bet_count: gammblerScores.settled_bet_count,
        win_rate: gammblerScores.win_rate,
        roi: gammblerScores.roi,
      })
      .from(gammblerScores)
      .innerJoin(users, eq(users.id, gammblerScores.user_id))
      .where(
        and(
          inArray(gammblerScores.user_id, friendIds),
          eq(gammblerScores.sport, sport as any)
        )
      )
      .orderBy(desc(gammblerScores.score));

    // Split into unlocked (ranked) and locked (bottom)
    const unlocked = scores.filter((s) => s.is_unlocked);
    const locked = scores.filter((s) => !s.is_unlocked);

    const leaderboard = [
      ...unlocked.map((s, i) => ({
        rank: i + 1,
        ...s,
        is_self: s.user_id === userId,
      })),
      ...locked.map((s) => ({
        rank: null,
        ...s,
        is_self: s.user_id === userId,
        locked_label: `Locked — ${s.settled_bet_count}/10 bets needed`,
      })),
    ];

    const userPosition = leaderboard.find((l) => l.is_self);

    res.json({ leaderboard, user_position: userPosition });
  } catch (err) {
    console.error('Friend leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /leaderboards/:sport/national — free + pro
router.get('/:sport/national', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const sport = req.params.sport;
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // Only show unlocked users on national leaderboard
    const scores = await db
      .select({
        user_id: gammblerScores.user_id,
        username: users.username,
        avatar_url: users.avatar_url,
        score: gammblerScores.score,
        settled_bet_count: gammblerScores.settled_bet_count,
        win_rate: gammblerScores.win_rate,
        roi: gammblerScores.roi,
      })
      .from(gammblerScores)
      .innerJoin(users, eq(users.id, gammblerScores.user_id))
      .where(
        and(
          eq(gammblerScores.sport, sport as any),
          eq(gammblerScores.is_unlocked, true)
        )
      )
      .orderBy(desc(gammblerScores.score))
      .limit(limit)
      .offset(offset);

    // Get capper tiers for all users in the result set
    const userIds = scores.map(s => s.user_id);
    const capperTiers = userIds.length > 0 ? await db
      .select({ user_id: capperProfiles.user_id, tier: capperProfiles.tier })
      .from(capperProfiles)
      .where(and(inArray(capperProfiles.user_id, userIds), eq(capperProfiles.status, 'active')))
    : [];
    const tierMap = new Map(capperTiers.map(c => [c.user_id, c.tier]));

    const leaderboard = scores.map((s, i) => ({
      rank: offset + i + 1,
      ...s,
      is_self: s.user_id === userId,
      capper_tier: tierMap.get(s.user_id) || null,
    }));

    // Get user's own position if not in top 100
    let userPosition = leaderboard.find((l) => l.is_self);
    if (!userPosition) {
      const [userScore] = await db
        .select({
          score: gammblerScores.score,
          is_unlocked: gammblerScores.is_unlocked,
        })
        .from(gammblerScores)
        .where(
          and(
            eq(gammblerScores.user_id, userId),
            eq(gammblerScores.sport, sport as any)
          )
        )
        .limit(1);

      if (userScore && userScore.is_unlocked) {
        // Count users above
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(gammblerScores)
          .where(
            and(
              eq(gammblerScores.sport, sport as any),
              eq(gammblerScores.is_unlocked, true),
              sql`${gammblerScores.score} > ${userScore.score}`
            )
          );

        userPosition = {
          rank: (countResult?.count || 0) + 1,
          user_id: userId,
          username: '',
          avatar_url: null,
          score: userScore.score,
          settled_bet_count: 0,
          win_rate: null,
          roi: null,
          is_self: true,
        } as any;
      }
    }

    res.json({ leaderboard, user_position: userPosition });
  } catch (err) {
    console.error('National leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
