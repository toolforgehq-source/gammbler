import { db } from '../db';
import { bets, badges, gammblerScores, sportsbookConnections, users } from '../db/schema';
import { eq, and, desc, sql, inArray, gte } from 'drizzle-orm';
import { BadgeType } from '@gammbler/shared';
import { createFeedEvent } from './feed';

export async function checkAndAwardBadges(userId: string): Promise<string[]> {
  const awarded: string[] = [];

  const existingBadges = await db
    .select({ badge_type: badges.badge_type })
    .from(badges)
    .where(eq(badges.user_id, userId));
  const has = new Set(existingBadges.map((b) => b.badge_type));

  const userBets = await db
    .select()
    .from(bets)
    .where(eq(bets.user_id, userId))
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

  return badgeType;
}
