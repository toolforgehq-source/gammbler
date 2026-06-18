import { db } from '../db';
import { bets, badges, gammblerScores, sportsbookConnections, users } from '../db/schema';
import { eq, and, desc, sql, inArray, gte } from 'drizzle-orm';
import { BadgeType } from '@gammbler/shared';
import { createFeedEvent } from './feed';
import { sendBadgeEarnedEmail } from './email';
import { notifyBadgeEarned } from './notification-triggers';

const BADGE_DISPLAY: Record<string, { name: string; description: string }> = {
  first_win: { name: 'First Win', description: 'Won your first bet on Gammbler' },
  sharp_shooter: { name: 'Sharp Shooter', description: 'Achieved a 60%+ win rate over 50+ bets' },
  elite_status: { name: 'Elite Status', description: 'Reached Elite tier (76+ Gammbler Score)' },
  legend: { name: 'Legend', description: 'Reached Legend tier (91+ Gammbler Score)' },
  profitable_month: { name: 'Profitable Month', description: 'Finished a month with positive ROI' },
  profitable_quarter: { name: 'Profitable Quarter', description: 'Finished a quarter with positive ROI' },
  consistent: { name: 'Consistent', description: 'Placed bets in 4 consecutive weeks' },
  hot_streak: { name: 'Hot Streak', description: 'Won 5 bets in a row' },
  on_fire: { name: 'On Fire', description: 'Won 10 bets in a row' },
  unstoppable: { name: 'Unstoppable', description: 'Won 15 bets in a row' },
  nfl_sharp: { name: 'NFL Sharp', description: 'Achieved Sharp tier or higher in NFL' },
  nba_sharp: { name: 'NBA Sharp', description: 'Achieved Sharp tier or higher in NBA' },
  mlb_sharp: { name: 'MLB Sharp', description: 'Achieved Sharp tier or higher in MLB' },
  nhl_sharp: { name: 'NHL Sharp', description: 'Achieved Sharp tier or higher in NHL' },
  cfb_sharp: { name: 'CFB Sharp', description: 'Achieved Sharp tier or higher in College Football' },
  cbb_sharp: { name: 'CBB Sharp', description: 'Achieved Sharp tier or higher in College Basketball' },
  connected: { name: 'Connected', description: 'Connected your first sportsbook' },
  all_in: { name: 'All In', description: 'Connected 3+ sportsbooks' },
  diversified: { name: 'Diversified', description: 'Placed bets in 5+ different sports' },
  veteran: { name: 'Veteran', description: 'Been a Gammbler member for 1+ year' },
  h2h_first_win: { name: 'H2H First Win', description: 'Won your first head-to-head challenge' },
  h2h_streak_3: { name: 'H2H 3-Win Streak', description: 'Won 3 head-to-head challenges in a row' },
  h2h_streak_5: { name: 'H2H 5-Win Streak', description: 'Won 5 head-to-head challenges in a row' },
  h2h_champion: { name: 'H2H Champion', description: 'Won 10 or more head-to-head challenges' },
};

export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  const awarded: string[] = [];

  const existingBadges = await db
    .select({ badge_type: badges.badge_type })
    .from(badges)
    .where(eq(badges.user_id, userId));
  const has = new Set(existingBadges.map((b) => b.badge_type));

  // Exclude manual_unverified bets from badge calculations
  const userBets = await db
    .select()
    .from(bets)
    .where(
      and(
        eq(bets.user_id, userId),
        sql`COALESCE(${bets.trust_status}, 'synced_verified') != 'manual_unverified'`
      )
    )
    .orderBy(desc(bets.settled_at));

  const settledBets = userBets.filter((b) => ['win', 'loss', 'push'].includes(b.result));
  const wins = settledBets.filter((b) => b.result === 'win');
  const totalStake = settledBets.reduce((s, b) => s + parseFloat(String(b.stake)), 0);
  const totalPL = settledBets.reduce((s, b) => s + parseFloat(String(b.profit_loss || '0')), 0);
  const roi = totalStake > 0 ? totalPL / totalStake : 0;

  const scores = await db
    .select()
    .from(gammblerScores)
    .where(eq(gammblerScores.user_id, userId));

  const overallScore = scores.find((s) => s.sport === 'overall');
  const overallScoreVal = overallScore ? parseFloat(String(overallScore.score)) : 0;

  // ── Performance badges ─────────────────────────────────────
  if (!has.has('first_win') && wins.length >= 1) {
    awarded.push(await awardBadge(userId, 'first_win'));
  }

  if (!has.has('sharp_shooter') && overallScoreVal >= 75) {
    awarded.push(await awardBadge(userId, 'sharp_shooter'));
  }

  if (!has.has('elite_status') && overallScoreVal >= 85) {
    awarded.push(await awardBadge(userId, 'elite_status'));
  }

  if (!has.has('legend') && overallScoreVal >= 95) {
    awarded.push(await awardBadge(userId, 'legend'));
  }

  if (!has.has('consistent') && settledBets.length >= 50 && roi > 0) {
    awarded.push(await awardBadge(userId, 'consistent'));
  }

  // Monthly/quarterly profitability
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthBets = settledBets.filter((b) => b.settled_at && new Date(b.settled_at) >= monthStart);
  const monthPL = monthBets.reduce((s, b) => s + parseFloat(String(b.profit_loss || '0')), 0);
  if (!has.has('profitable_month') && monthBets.length >= 10 && monthPL > 0) {
    awarded.push(await awardBadge(userId, 'profitable_month'));
  }

  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const quarterBets = settledBets.filter((b) => b.settled_at && new Date(b.settled_at) >= quarterStart);
  const quarterPL = quarterBets.reduce((s, b) => s + parseFloat(String(b.profit_loss || '0')), 0);
  if (!has.has('profitable_quarter') && quarterBets.length >= 25 && quarterPL > 0) {
    awarded.push(await awardBadge(userId, 'profitable_quarter'));
  }

  // ── Streak badges ──────────────────────────────────────────
  const sortedBySettle = settledBets
    .filter((b) => b.result !== 'push')
    .sort((a, b) => new Date(b.settled_at!).getTime() - new Date(a.settled_at!).getTime());

  let winStreak = 0;
  for (const bet of sortedBySettle) {
    if (bet.result === 'win') winStreak++;
    else break;
  }

  if (!has.has('hot_streak') && winStreak >= 5) {
    awarded.push(await awardBadge(userId, 'hot_streak'));
  }
  if (!has.has('on_fire') && winStreak >= 10) {
    awarded.push(await awardBadge(userId, 'on_fire'));
  }
  if (!has.has('unstoppable') && winStreak >= 15) {
    awarded.push(await awardBadge(userId, 'unstoppable'));
  }

  // Win streak feed event
  if (winStreak >= 5 && winStreak % 5 === 0) {
    await createFeedEvent(userId, 'win_streak', { streak: winStreak });
  }

  // ── Sport specialist badges ────────────────────────────────
  const sportBadgeMap: Record<string, string> = {
    nfl: 'nfl_sharp',
    nba: 'nba_sharp',
    mlb: 'mlb_sharp',
    nhl: 'nhl_sharp',
    cfb: 'cfb_sharp',
    cbb: 'cbb_sharp',
  };

  for (const [sport, badgeKey] of Object.entries(sportBadgeMap)) {
    if (has.has(badgeKey as BadgeType)) continue;
    const sportScore = scores.find((s) => s.sport === sport);
    if (!sportScore || !sportScore.is_unlocked) continue;
    const sportBets = settledBets.filter((b) => b.sport === sport);
    if (sportBets.length >= 30 && parseFloat(String(sportScore.score)) >= 75) {
      awarded.push(await awardBadge(userId, badgeKey));
    }
  }

  // ── Activity badges ────────────────────────────────────────
  const connections = await db
    .select()
    .from(sportsbookConnections)
    .where(eq(sportsbookConnections.user_id, userId));

  if (!has.has('connected') && connections.length >= 1) {
    awarded.push(await awardBadge(userId, 'connected'));
  }

  if (!has.has('all_in') && connections.length >= 3) {
    awarded.push(await awardBadge(userId, 'all_in'));
  }

  const uniqueSports = new Set(settledBets.map((b) => b.sport));
  if (!has.has('diversified') && uniqueSports.size >= 4) {
    awarded.push(await awardBadge(userId, 'diversified'));
  }

  const [user] = await db.select({ created_at: users.created_at }).from(users).where(eq(users.id, userId)).limit(1);
  if (user && !has.has('veteran')) {
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    if (new Date(user.created_at) <= yearAgo) {
      awarded.push(await awardBadge(userId, 'veteran'));
    }
  }

  return awarded;
}

async function awardBadge(userId: string, badgeType: string): Promise<string> {
  await db.insert(badges).values({
    user_id: userId,
    badge_type: badgeType as any,
  }).onConflictDoNothing();

  await createFeedEvent(userId, 'badge_earned', { badge: badgeType });

  // Send badge email (fire & forget)
  const [user] = await db
    .select({ email: users.email, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user) {
    const display = BADGE_DISPLAY[badgeType] || { name: badgeType, description: '' };
    sendBadgeEarnedEmail(user.email, user.username, display.name, display.description).catch(() => {});
    notifyBadgeEarned(userId, display.name).catch(() => {});
  }

  return badgeType;
}
