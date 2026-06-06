import { Router, Request, Response } from 'express';
import { db } from '../db';
import { badges } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { requirePro } from '../middleware/subscription';

const router = Router();

const BADGE_INFO: Record<string, { name: string; description: string; icon: string }> = {
  first_win: { name: 'First Win', description: 'Won your first bet', icon: '🏆' },
  sharp_shooter: { name: 'Sharp Shooter', description: 'Gammbler Score above 75', icon: '🎯' },
  elite_status: { name: 'Elite Status', description: 'Gammbler Score above 85', icon: '⭐' },
  legend: { name: 'Legend', description: 'Gammbler Score above 95', icon: '👑' },
  profitable_month: { name: 'Profitable Month', description: 'Positive ROI for a full calendar month', icon: '📈' },
  profitable_quarter: { name: 'Profitable Quarter', description: 'Positive ROI for a full quarter', icon: '💰' },
  consistent: { name: 'Consistent', description: '50+ bets settled with positive ROI', icon: '🔄' },
  hot_streak: { name: 'Hot Streak', description: '5 consecutive winning bets', icon: '🔥' },
  on_fire: { name: 'On Fire', description: '10 consecutive winning bets', icon: '🔥🔥' },
  unstoppable: { name: 'Unstoppable', description: '15 consecutive winning bets', icon: '⚡' },
  nfl_sharp: { name: 'NFL Sharp', description: 'Top 25% Gammbler Score in NFL with 30+ bets', icon: '🏈' },
  nba_sharp: { name: 'NBA Sharp', description: 'Top 25% Gammbler Score in NBA with 30+ bets', icon: '🏀' },
  mlb_sharp: { name: 'MLB Sharp', description: 'Top 25% Gammbler Score in MLB with 30+ bets', icon: '⚾' },
  nhl_sharp: { name: 'NHL Sharp', description: 'Top 25% Gammbler Score in NHL with 30+ bets', icon: '🏒' },
  cfb_sharp: { name: 'CFB Sharp', description: 'Top 25% Gammbler Score in CFB with 30+ bets', icon: '🏟️' },
  cbb_sharp: { name: 'CBB Sharp', description: 'Top 25% Gammbler Score in CBB with 30+ bets', icon: '🏀' },
  connected: { name: 'Connected', description: 'Connected your first sportsbook', icon: '🔗' },
  all_in: { name: 'All In', description: 'Connected 3+ sportsbooks', icon: '🃏' },
  diversified: { name: 'Diversified', description: 'Bets logged across 4+ sports', icon: '🌐' },
  veteran: { name: 'Veteran', description: 'Member for 1 year', icon: '🎖️' },
};

// GET /badges — get user's earned badges
router.get('/', authMiddleware, requirePro, async (req: Request, res: Response): Promise<void> => {
  try {
    const userBadges = await db
      .select()
      .from(badges)
      .where(eq(badges.user_id, req.user!.userId))
      .orderBy(desc(badges.earned_at));

    const enriched = userBadges.map((b) => ({
      ...b,
      info: BADGE_INFO[b.badge_type] || { name: b.badge_type, description: '', icon: '🏅' },
    }));

    res.json({ badges: enriched });
  } catch (err) {
    console.error('List badges error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /badges/all — get all possible badges with earned status
router.get('/all', authMiddleware, requirePro, async (req: Request, res: Response): Promise<void> => {
  try {
    const userBadges = await db
      .select()
      .from(badges)
      .where(eq(badges.user_id, req.user!.userId));

    const earnedSet = new Set(userBadges.map((b) => b.badge_type));

    const allBadges = Object.entries(BADGE_INFO).map(([key, info]) => ({
      badge_type: key,
      ...info,
      earned: earnedSet.has(key as any),
      earned_at: userBadges.find((b) => b.badge_type === key)?.earned_at || null,
    }));

    res.json({ badges: allBadges });
  } catch (err) {
    console.error('All badges error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
