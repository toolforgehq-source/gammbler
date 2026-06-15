import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users, bets, challenges, leagues } from '../db/schema';
import { sql } from 'drizzle-orm';

const router = Router();

// GET /stats/public — returns live platform stats (no auth required)
router.get('/public', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [userCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    const [betCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bets);

    const [challengeCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(challenges);

    const [leagueCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leagues);

    res.json({
      users: userCount.count,
      bets: betCount.count,
      challenges: challengeCount.count,
      leagues: leagueCount.count,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
