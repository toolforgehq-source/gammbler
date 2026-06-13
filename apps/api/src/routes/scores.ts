import { Router, Request, Response } from 'express';
import { db } from '../db';
import { gammblerScores, users, bets, dfsContests } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { attachTier, requirePro } from '../middleware/subscription';

const router = Router();

// GET /scores — free users get overall only, pro gets all
router.get('/', authMiddleware, attachTier, async (req: Request, res: Response): Promise<void> => {
  try {
    const scores = await db
      .select()
      .from(gammblerScores)
      .where(eq(gammblerScores.user_id, req.user!.userId));

    if (req.userTier === 'free') {
      const overall = scores.find((s) => s.sport === 'overall');
      const locked = scores
        .filter((s) => s.sport !== 'overall')
        .map((s) => ({ sport: s.sport, score: null, is_unlocked: false, settled_bet_count: s.settled_bet_count, locked: true }));
      res.json({
        scores: overall ? [overall, ...locked] : locked,
        tier: 'free',
      });
      return;
    }

    res.json({ scores, tier: 'pro' });
  } catch (err) {
    console.error('Get scores error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /scores/my-rank — get user's overall national rank
router.get('/my-rank', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const [userScore] = await db
      .select({
        score: gammblerScores.score,
        is_unlocked: gammblerScores.is_unlocked,
      })
      .from(gammblerScores)
      .where(
        and(
          eq(gammblerScores.user_id, userId),
          eq(gammblerScores.sport, 'overall' as any)
        )
      )
      .limit(1);

    if (!userScore || !userScore.is_unlocked) {
      res.json({ rank: null, total_ranked: 0 });
      return;
    }

    const [countAbove] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gammblerScores)
      .where(
        and(
          eq(gammblerScores.sport, 'overall' as any),
          eq(gammblerScores.is_unlocked, true),
          sql`${gammblerScores.score} > ${userScore.score}`
        )
      );

    const [totalRanked] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gammblerScores)
      .where(
        and(
          eq(gammblerScores.sport, 'overall' as any),
          eq(gammblerScores.is_unlocked, true)
        )
      );

    res.json({
      rank: (countAbove?.count || 0) + 1,
      total_ranked: totalRanked?.count || 0,
    });
  } catch (err) {
    console.error('Get my rank error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /scores/verification/:userId — verification stats for a user
router.get('/verification/:userId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params.userId;

    // Betting verification stats
    const [betStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        pregame_verified: sql<number>`count(*) filter (where ${bets.is_pregame_verified} = true)::int`,
        synced: sql<number>`count(*) filter (where ${bets.is_manual} = false)::int`,
        manual: sql<number>`count(*) filter (where ${bets.is_manual} = true)::int`,
      })
      .from(bets)
      .where(eq(bets.user_id, targetUserId));

    // DFS verification stats
    const [dfsStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        csv_imported: sql<number>`count(*) filter (where ${dfsContests.is_csv_import} = true)::int`,
        manual: sql<number>`count(*) filter (where ${dfsContests.is_manual} = true and ${dfsContests.is_csv_import} = false)::int`,
      })
      .from(dfsContests)
      .where(eq(dfsContests.user_id, targetUserId));

    const totalBets = betStats?.total || 0;
    const totalDfs = dfsStats?.total || 0;
    const totalEntries = totalBets + totalDfs;

    const verifiedBets = (betStats?.pregame_verified || 0) + (betStats?.synced || 0);
    const verifiedDfs = dfsStats?.csv_imported || 0;
    const totalVerified = verifiedBets + verifiedDfs;

    const verificationPct = totalEntries > 0 ? Math.round((totalVerified / totalEntries) * 100) : 0;

    let verificationLevel: 'unverified' | 'bronze' | 'silver' | 'gold' | 'diamond';
    if (verificationPct >= 90) verificationLevel = 'diamond';
    else if (verificationPct >= 70) verificationLevel = 'gold';
    else if (verificationPct >= 40) verificationLevel = 'silver';
    else if (verificationPct >= 10) verificationLevel = 'bronze';
    else verificationLevel = 'unverified';

    res.json({
      verification_pct: verificationPct,
      verification_level: verificationLevel,
      betting: {
        total: totalBets,
        pregame_verified: betStats?.pregame_verified || 0,
        sportsbook_synced: betStats?.synced || 0,
        manual_unverified: (betStats?.manual || 0) - (betStats?.pregame_verified || 0),
      },
      dfs: {
        total: totalDfs,
        csv_imported: dfsStats?.csv_imported || 0,
        manual: dfsStats?.manual || 0,
      },
    });
  } catch (err) {
    console.error('Verification stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /scores/:sport — pro only for sport-specific scores
router.get('/:sport', authMiddleware, attachTier, async (req: Request, res: Response): Promise<void> => {
  try {
    const sport = req.params.sport;

    if (req.userTier === 'free' && sport !== 'overall') {
      res.status(403).json({ error: 'Pro subscription required for sport-specific scores', upgrade: true });
      return;
    }

    const [score] = await db
      .select()
      .from(gammblerScores)
      .where(
        and(
          eq(gammblerScores.user_id, req.user!.userId),
          eq(gammblerScores.sport, sport as any)
        )
      )
      .limit(1);

    if (!score) {
      res.json({ score: null, is_unlocked: false, settled_bet_count: 0 });
      return;
    }

    res.json({ score });
  } catch (err) {
    console.error('Get sport score error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /scores/user/:userId — get public scores for another user
router.get('/user/:userId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const [user] = await db
      .select({ is_profile_public: users.is_profile_public })
      .from(users)
      .where(eq(users.id, req.params.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const scores = await db
      .select({
        sport: gammblerScores.sport,
        score: gammblerScores.score,
        is_unlocked: gammblerScores.is_unlocked,
        settled_bet_count: gammblerScores.settled_bet_count,
        calculated_at: gammblerScores.calculated_at,
      })
      .from(gammblerScores)
      .where(eq(gammblerScores.user_id, req.params.userId));

    if (!user.is_profile_public) {
      const publicScores = scores.map((s) => ({
        sport: s.sport,
        score: s.score,
        is_unlocked: s.is_unlocked,
      }));
      res.json({ scores: publicScores, is_private: true });
      return;
    }

    res.json({ scores, is_private: false });
  } catch (err) {
    console.error('Get user scores error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
