import { Router, Request, Response } from 'express';
import { db } from '../db';
import { badges, dfsBadges, creatorBadges } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { requirePro } from '../middleware/subscription';
import { CREATOR_BADGE_DEFS } from '../services/creator-badges';

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

const DFS_BADGE_INFO: Record<string, { name: string; description: string; image: string }> = {
  dfs_first_cash: { name: 'DFS First Cash', description: 'First DFS payout', image: '/badges/dfs_first_cash.png' },
  dfs_sharp: { name: 'DFS Sharp', description: 'DFS Score 61+', image: '/badges/dfs_sharp.png' },
  dfs_elite: { name: 'DFS Elite', description: 'DFS Score 76+', image: '/badges/dfs_elite.png' },
  dfs_legend: { name: 'DFS Legend', description: 'DFS Score 91+', image: '/badges/dfs_legend.png' },
  dfs_grinder: { name: 'DFS Grinder', description: '100+ DFS contests entered', image: '/badges/dfs_grinder.png' },
  dfs_nfl_sharp: { name: 'DFS NFL Sharp', description: 'DFS Score 61+ in NFL', image: '/badges/dfs_nfl_sharp.png' },
  dfs_nba_sharp: { name: 'DFS NBA Sharp', description: 'DFS Score 61+ in NBA', image: '/badges/dfs_nba_sharp.png' },
  dfs_mlb_sharp: { name: 'DFS MLB Sharp', description: 'DFS Score 61+ in MLB', image: '/badges/dfs_mlb_sharp.png' },
  dfs_nhl_sharp: { name: 'DFS NHL Sharp', description: 'DFS Score 61+ in NHL', image: '/badges/dfs_nhl_sharp.png' },
  dfs_pga_sharp: { name: 'DFS PGA Sharp', description: 'DFS Score 61+ in PGA', image: '/badges/dfs_pga_sharp.png' },
  dfs_nascar_sharp: { name: 'DFS NASCAR Sharp', description: 'DFS Score 61+ in NASCAR', image: '/badges/dfs_nascar_sharp.png' },
  dfs_diversified: { name: 'DFS Diversified', description: 'Entered 4+ different contest types', image: '/badges/dfs_diversified.png' },
  dfs_gpp_winner: { name: 'DFS GPP Winner', description: 'Won 1st place in a GPP tournament', image: '/badges/dfs_gpp_winner.png' },
};

const TIER_BADGE_INFO: Record<string, { name: string; description: string; image: string }> = {
  tier_recreational: { name: 'Recreational', description: 'Gammbler Score ≤ 40', image: '/badges/tier_recreational.png' },
  tier_developing: { name: 'Developing', description: 'Gammbler Score 41–60', image: '/badges/tier_developing.png' },
  tier_sharp: { name: 'Sharp', description: 'Gammbler Score 61–75', image: '/badges/tier_sharp.png' },
  tier_elite: { name: 'Elite', description: 'Gammbler Score 76–90', image: '/badges/tier_elite.png' },
  tier_legend: { name: 'Legend', description: 'Gammbler Score 91+', image: '/badges/tier_legend.png' },
};

const CAPPER_BADGE_INFO: Record<string, { name: string; description: string; image: string }> = {
  capper_base: { name: 'Capper', description: 'Registered capper on Gammbler', image: '/badges/capper_base.png' },
  capper_verified: { name: 'Verified Capper', description: 'Score 75+ with 50+ picks', image: '/badges/capper_verified.png' },
  capper_elite: { name: 'Elite Capper', description: 'Score 85+ with 100+ picks', image: '/badges/capper_elite.png' },
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

// GET /badges/all-categories — unified view of all 68 badges across betting, DFS, creator, tier, and capper
router.get('/all-categories', authMiddleware, requirePro, async (req: Request, res: Response): Promise<void> => {
  try {
    // Fetch earned badges from all three tables in parallel
    const userId = req.user!.userId;
    const [userBettingBadges, userDfsBadges, userCreatorBadges] = await Promise.all([
      db.select().from(badges).where(eq(badges.user_id, userId)),
      db.select().from(dfsBadges).where(eq(dfsBadges.user_id, userId)),
      db.select().from(creatorBadges).where(eq(creatorBadges.user_id, userId)),
    ]);

    const earnedBetting = new Map(userBettingBadges.map((b) => [b.badge_type, b.earned_at]));
    const earnedDfs = new Map(userDfsBadges.map((b) => [b.badge_type, b.earned_at]));
    const earnedCreator = new Map(userCreatorBadges.map((b) => [b.badge_id, b.earned_at]));

    // Build unified badge list grouped by category
    const categories: Array<{
      id: string;
      label: string;
      badges: Array<{
        badge_type: string;
        name: string;
        description: string;
        image: string;
        category: string;
        earned: boolean;
        earned_at: Date | null;
      }>;
    }> = [
      {
        id: 'betting',
        label: 'Betting',
        badges: Object.entries(BADGE_INFO).map(([key, info]) => ({
          badge_type: key,
          name: info.name,
          description: info.description,
          image: info.image,
          category: 'betting',
          earned: earnedBetting.has(key as any),
          earned_at: earnedBetting.get(key as any) || null,
        })),
      },
      {
        id: 'dfs',
        label: 'DFS',
        badges: Object.entries(DFS_BADGE_INFO).map(([key, info]) => ({
          badge_type: key,
          name: info.name,
          description: info.description,
          image: info.image,
          category: 'dfs',
          earned: earnedDfs.has(key as any),
          earned_at: earnedDfs.get(key as any) || null,
        })),
      },
      {
        id: 'creator',
        label: 'Creator',
        badges: CREATOR_BADGE_DEFS.map((def) => ({
          badge_type: def.id,
          name: def.name,
          description: def.description,
          image: def.image,
          category: 'creator',
          earned: earnedCreator.has(def.id),
          earned_at: earnedCreator.get(def.id) || null,
        })),
      },
      {
        id: 'tier',
        label: 'Score Tiers',
        badges: Object.entries(TIER_BADGE_INFO).map(([key, info]) => ({
          badge_type: key,
          name: info.name,
          description: info.description,
          image: info.image,
          category: 'tier',
          earned: false,
          earned_at: null,
        })),
      },
      {
        id: 'capper',
        label: 'Capper',
        badges: Object.entries(CAPPER_BADGE_INFO).map(([key, info]) => ({
          badge_type: key,
          name: info.name,
          description: info.description,
          image: info.image,
          category: 'capper',
          earned: false,
          earned_at: null,
        })),
      },
    ];

    // Determine tier badge earned status based on user's score
    // We check if the user has a matching betting badge to infer tier
    const hasSharp = earnedBetting.has('sharp_shooter' as any);
    const hasElite = earnedBetting.has('elite_status' as any);
    const hasLegend = earnedBetting.has('legend' as any);
    const tierCategory = categories.find((c) => c.id === 'tier')!;
    // Everyone who has an account has at least recreational
    tierCategory.badges[0].earned = true; // tier_recreational
    if (hasSharp) {
      tierCategory.badges[1].earned = true; // tier_developing (score > 40 implied)
      tierCategory.badges[2].earned = true; // tier_sharp
    }
    if (hasElite) {
      tierCategory.badges[1].earned = true; // tier_developing
      tierCategory.badges[2].earned = true; // tier_sharp
      tierCategory.badges[3].earned = true; // tier_elite
    }
    if (hasLegend) {
      tierCategory.badges[1].earned = true; // tier_developing
      tierCategory.badges[2].earned = true; // tier_sharp
      tierCategory.badges[3].earned = true; // tier_elite
      tierCategory.badges[4].earned = true; // tier_legend
    }

    // Determine capper badge earned status
    const capperCategory = categories.find((c) => c.id === 'capper')!;
    // Check if user has capper_verified or capper_elite betting badges or capper profile
    if (earnedBetting.has('verified' as any)) {
      capperCategory.badges[0].earned = true; // capper_base (if verified, likely a capper)
    }

    const flat = categories.flatMap((c) => c.badges);
    const totalEarned = flat.filter((b) => b.earned).length;

    res.json({ categories, total: flat.length, earned: totalEarned });
  } catch (err) {
    console.error('All categories badges error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
