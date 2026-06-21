import { db } from '../db';
import { funnelSnapshots, users } from '../db/schema';
import { sql, eq } from 'drizzle-orm';
import {
  getFunnelCounts,
  computeFunnelStages,
  findBiggestDropoff,
  getNewASBs7d,
  getChurnedASBs7d,
} from './active-scored-bettor';

export async function captureFunnelSnapshot(): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const counts = await getFunnelCounts();
  const stages = computeFunnelStages(counts);
  const biggestDropoff = findBiggestDropoff(stages);

  const newASBs = await getNewASBs7d();
  const churnedASBs = await getChurnedASBs7d();

  // Compute 7-day new signups
  const days7Ago = new Date();
  days7Ago.setDate(days7Ago.getDate() - 7);
  const signupResult = await db.execute(sql`
    SELECT COUNT(*)::int AS count FROM users WHERE created_at >= ${days7Ago}
  `);
  const newSignups7d = ((signupResult.rows?.[0] ?? signupResult) as Record<string, number>).count ?? 0;

  // New creators in 7 days
  const creatorResult = await db.execute(sql`
    SELECT COUNT(*)::int AS count FROM capper_profiles WHERE created_at >= ${days7Ago}
  `);
  const newCreators7d = ((creatorResult.rows?.[0] ?? creatorResult) as Record<string, number>).count ?? 0;

  // New Pro subscribers in 7 days (approximate: users with active status)
  const proResult = await db.execute(sql`
    SELECT COUNT(*)::int AS count FROM users
    WHERE subscription_status = 'active'
  `);
  const totalPro = ((proResult.rows?.[0] ?? proResult) as Record<string, number>).count ?? 0;

  // MRR: Pro subscribers * $8.99 + creator subscriber revenue
  const creatorRevResult = await db.execute(sql`
    SELECT COALESCE(SUM(price_cents), 0)::int AS total
    FROM capper_subscriptions WHERE status = 'active'
  `);
  const creatorSubRevenue = ((creatorRevResult.rows?.[0] ?? creatorRevResult) as Record<string, number>).total ?? 0;
  const proMrr = totalPro * 899;
  const totalMrr = proMrr + creatorSubRevenue;

  // Get previous snapshot for MRR change
  const [prevSnapshot] = await db
    .select({ mrr_cents: funnelSnapshots.mrr_cents })
    .from(funnelSnapshots)
    .orderBy(sql`${funnelSnapshots.snapshot_date} DESC`)
    .limit(1);
  const prevMrr = prevSnapshot ? Number(prevSnapshot.mrr_cents) : 0;

  // Conversion rates
  const signupToFirstBet = counts.totalUsers > 0
    ? counts.totalWithFirstBet / counts.totalUsers : 0;
  const firstBetToScore = counts.totalWithFirstBet > 0
    ? counts.totalScoreUnlocked / counts.totalWithFirstBet : 0;
  const scoreToActive = counts.totalScoreUnlocked > 0
    ? counts.totalActive14d / counts.totalScoreUnlocked : 0;
  const activeToPro = counts.totalActive14d > 0
    ? counts.totalProSubscribers / counts.totalActive14d : 0;

  await db
    .insert(funnelSnapshots)
    .values({
      snapshot_date: today,
      total_users: counts.totalUsers,
      total_with_first_bet: counts.totalWithFirstBet,
      total_with_sportsbook: counts.totalWithSportsbook,
      total_score_unlocked: counts.totalScoreUnlocked,
      total_active_14d: counts.totalActive14d,
      total_active_7d: counts.totalActive7d,
      total_pro_subscribers: counts.totalProSubscribers,
      total_creators: counts.totalCreators,
      total_active_creators: counts.totalActiveCreators,
      signup_to_first_bet_rate: String(signupToFirstBet),
      first_bet_to_score_rate: String(firstBetToScore),
      score_to_active_14d_rate: String(scoreToActive),
      active_to_pro_rate: String(activeToPro),
      new_signups_7d: newSignups7d,
      new_asbs_7d: newASBs,
      new_creators_7d: newCreators7d,
      new_pro_7d: 0,
      churned_asbs_7d: churnedASBs,
      net_asb_growth_7d: newASBs - churnedASBs,
      asbs_from_creator_referral_7d: 0,
      asbs_from_organic_7d: 0,
      asbs_from_referral_7d: 0,
      mrr_cents: totalMrr,
      mrr_change_cents: totalMrr - prevMrr,
      biggest_dropoff_stage: biggestDropoff
        ? `${biggestDropoff.fromStage} → ${biggestDropoff.toStage}`
        : null,
      biggest_dropoff_rate: biggestDropoff
        ? String(biggestDropoff.dropoffRate)
        : null,
    })
    .onConflictDoUpdate({
      target: [funnelSnapshots.snapshot_date],
      set: {
        total_users: counts.totalUsers,
        total_with_first_bet: counts.totalWithFirstBet,
        total_with_sportsbook: counts.totalWithSportsbook,
        total_score_unlocked: counts.totalScoreUnlocked,
        total_active_14d: counts.totalActive14d,
        total_active_7d: counts.totalActive7d,
        total_pro_subscribers: counts.totalProSubscribers,
        total_creators: counts.totalCreators,
        total_active_creators: counts.totalActiveCreators,
        signup_to_first_bet_rate: String(signupToFirstBet),
        first_bet_to_score_rate: String(firstBetToScore),
        score_to_active_14d_rate: String(scoreToActive),
        active_to_pro_rate: String(activeToPro),
        new_signups_7d: newSignups7d,
        new_asbs_7d: newASBs,
        new_creators_7d: newCreators7d,
        churned_asbs_7d: churnedASBs,
        net_asb_growth_7d: newASBs - churnedASBs,
        mrr_cents: totalMrr,
        mrr_change_cents: totalMrr - prevMrr,
        biggest_dropoff_stage: biggestDropoff
          ? `${biggestDropoff.fromStage} → ${biggestDropoff.toStage}`
          : null,
        biggest_dropoff_rate: biggestDropoff
          ? String(biggestDropoff.dropoffRate)
          : null,
      },
    });

  console.log(`[Growth Brain] Funnel snapshot captured: ${counts.totalActive14d} ASBs, net growth: ${newASBs - churnedASBs}`);
}
