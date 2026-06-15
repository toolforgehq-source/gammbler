import { Router, Request, Response } from 'express';
import { db } from '../db';
import { badges } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { requirePro } from '../middleware/subscription';

const router = Router();

const BADGE_INFO: Record<string, { name: string; description: string; icon: string; image: string }> = {
  first_win: { name: 'First Win', description: 'Won your first bet', icon: '🏆', image: '/badges/first_win.png' },
  sharp_shooter: { name: 'Sharp Shooter', description: 'Gammbler Score above 75', icon: '🎯', image: '/badges/sharp_shooter.png' },
  elite_status: { name: 'Elite Status', description: 'Gammbler Score above 85', icon: '⭐', image: '/badges/elite_status.png' },
  legend: { name: 'Legend', description: 'Gammbler Score above 95', icon: '👑', image: '/badges/legend.png' },
  profitable_month: { name: 'Profitable Month', description: 'Positive ROI for a full calendar month', icon: '📈', image: '/badges/profitable_month.png' },
  profitable_quarter: { name: 'Profitable Quarter', description: 'Positive ROI for a full quarter', icon: '💰', image: '/badges/profitable_quarter.png' },
  consistent: { name: 'Consistent', description: '50+ bets settled with positive ROI', icon: '🔄', image: '/badges/consistent.png' },
  hot_streak: { name: 'Hot Streak', description: '5 consecutive winning bets', icon: '🔥', image: '/badges/hot_streak.png' },
  on_fire: { name: 'On Fire', description: '10 consecutive winning bets', icon: '🔥🔥', image: '/badges/on_fire.png' },
  unstoppable: { name: 'Unstoppable', description: '15 consecutive winning bets', icon: '⚡', image: '/badges/unstoppable.png' },
  nfl_sharp: { name: 'NFL Sharp', description: 'Top 25% Gammbler Score in NFL with 30+ bets', icon: '🏈', image: '/badges/nfl_sharp.png' },
  nba_sharp: { name: 'NBA Sharp', description: 'Top 25% Gammbler Score in NBA with 30+ bets', icon: '🏀', image: '/badges/nba_sharp.png' },
  mlb_sharp: { name: 'MLB Sharp', description: 'Top 25% Gammbler Score in MLB with 30+ bets', icon: '⚾', image: '/badges/mlb_sharp.png' },
  nhl_sharp: { name: 'NHL Sharp', description: 'Top 25% Gammbler Score in NHL with 30+ bets', icon: '🏒', image: '/badges/nhl_sharp.png' },
  cfb_sharp: { name: 'CFB Sharp', description: 'Top 25% Gammbler Score in CFB with 30+ bets', icon: '🏟️', image: '/badges/cfb_sharp.png' },
  cbb_sharp: { name: 'CBB Sharp', description: 'Top 25% Gammbler Score in CBB with 30+ bets', icon: '🏀', image: '/badges/cbb_sharp.png' },
  connected: { name: 'Connected', description: 'Connected your first sportsbook', icon: '🔗', image: '/badges/connected.png' },
  all_in: { name: 'All In', description: 'Connected 3+ sportsbooks', icon: '🃏', image: '/badges/all_in.png' },
  diversified: { name: 'Diversified', description: 'Bets logged across 4+ sports', icon: '🌐', image: '/badges/diversified.png' },
  veteran: { name: 'Veteran', description: 'Member for 1 year', icon: '🎖️', image: '/badges/veteran.png' },
  h2h_first_win: { name: 'H2H First Win', description: 'Won your first head-to-head challenge', icon: '⚔️', image: '/badges/h2h_first_win.png' },
  h2h_streak_3: { name: 'H2H 3-Win Streak', description: 'Won 3 head-to-head challenges in a row', icon: '⚔️', image: '/badges/h2h_streak_3.png' },
  h2h_streak_5: { name: 'H2H 5-Win Streak', description: 'Won 5 head-to-head challenges in a row', icon: '⚔️', image: '/badges/h2h_streak_5.png' },
  h2h_champion: { name: 'H2H Champion', description: 'Won 10+ head-to-head challenges', icon: '🏆', image: '/badges/h2h_champion.png' },
  verified: { name: 'Verified', description: 'Connected via sportsbook — verified score', icon: '✅', image: '/badges/verified.png' },
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
      info: BADGE_INFO[b.badge_type] || { name: b.badge_type, description: '', icon: '🏅', image: `/badges/${b.badge_type}.png` },
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
