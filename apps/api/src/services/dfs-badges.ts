import { db } from '../db';
import { dfsBadges, dfsScores, dfsContests } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

type DfsBadge = typeof dfsBadges.$inferInsert;

export async function checkAndAwardDfsBadges(userId: string): Promise<string[]> {
  const awarded: string[] = [];

  const scores = await db.select().from(dfsScores).where(eq(dfsScores.user_id, userId));
  const overall = scores.find((s) => s.sport === 'overall');

  if (!overall) return awarded;

  const overallScore = Number(overall.score);
  const totalContests = overall.total_contests;

  // First Cash badge
  if (overall.total_payouts_cents > 0) {
    if (await tryAward(userId, 'dfs_first_cash')) awarded.push('dfs_first_cash');
  }

  // Tier badges
  if (overallScore >= 61 && overall.is_unlocked) {
    if (await tryAward(userId, 'dfs_sharp')) awarded.push('dfs_sharp');
  }
  if (overallScore >= 76 && overall.is_unlocked) {
    if (await tryAward(userId, 'dfs_elite')) awarded.push('dfs_elite');
  }
  if (overallScore >= 91 && overall.is_unlocked) {
    if (await tryAward(userId, 'dfs_legend')) awarded.push('dfs_legend');
  }

  // Volume badges
  if (totalContests >= 100) {
    if (await tryAward(userId, 'dfs_grinder')) awarded.push('dfs_grinder');
  }

  // Sport-specific sharp badges
  for (const s of scores) {
    if (s.sport === 'overall') continue;
    if (Number(s.score) >= 61 && s.is_unlocked) {
      const badgeType = `dfs_${s.sport}_sharp` as any;
      const validBadges = [
        'dfs_nfl_sharp', 'dfs_nba_sharp', 'dfs_mlb_sharp',
        'dfs_nhl_sharp', 'dfs_pga_sharp', 'dfs_nascar_sharp',
      ];
      if (validBadges.includes(badgeType)) {
        if (await tryAward(userId, badgeType)) awarded.push(badgeType);
      }
    }
  }

  // Diversity badge
  const contestTypes = await db
    .select({ contest_type: dfsContests.contest_type })
    .from(dfsContests)
    .where(eq(dfsContests.user_id, userId))
    .groupBy(dfsContests.contest_type);

  if (contestTypes.length >= 4) {
    if (await tryAward(userId, 'dfs_diversified')) awarded.push('dfs_diversified');
  }

  // GPP Winner badge
  const [gppWin] = await db
    .select({ count: sql<number>`count(*)` })
    .from(dfsContests)
    .where(
      and(
        eq(dfsContests.user_id, userId),
        eq(dfsContests.contest_type, 'gpp'),
        sql`${dfsContests.finish_position} = 1`,
      ),
    );

  if (gppWin && gppWin.count > 0) {
    if (await tryAward(userId, 'dfs_gpp_winner')) awarded.push('dfs_gpp_winner');
  }

  return awarded;
}

async function tryAward(userId: string, badgeType: string): Promise<boolean> {
  try {
    await db.insert(dfsBadges).values({
      user_id: userId,
      badge_type: badgeType as any,
    }).onConflictDoNothing();
    return true;
  } catch {
    return false;
  }
}
