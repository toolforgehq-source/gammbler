import { Router, Request, Response } from 'express';
import { db } from '../db';
import { gammblerScores, users } from '../db/schema';
import { eq, and } from 'drizzle-orm';
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
