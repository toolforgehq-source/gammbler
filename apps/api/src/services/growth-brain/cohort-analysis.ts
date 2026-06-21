import { db } from '../../db';
import { sql } from 'drizzle-orm';

export interface CohortData {
  cohortWeek: string;
  signups: number;
  reachedFirstBet: number;
  reachedFirstBetPct: number;
  reachedScoreUnlock: number;
  reachedScoreUnlockPct: number;
  becameASB: number;
  becameASBPct: number;
  becamePro: number;
  becameProPct: number;
  weeksSinceSignup: number;
}

export async function getWeeklyCohorts(weeksBack: number = 12): Promise<CohortData[]> {
  const results = await db.execute(sql`
    WITH cohorts AS (
      SELECT
        DATE_TRUNC('week', u.created_at)::date AS cohort_week,
        u.id AS user_id,
        EXTRACT(WEEK FROM AGE(NOW(), u.created_at))::int AS weeks_since_signup
      FROM users u
      WHERE u.created_at >= NOW() - (${weeksBack} || ' weeks')::interval
    ),
    cohort_metrics AS (
      SELECT
        c.cohort_week,
        c.weeks_since_signup,
        COUNT(DISTINCT c.user_id)::int AS signups,
        COUNT(DISTINCT c.user_id) FILTER (
          WHERE EXISTS (SELECT 1 FROM bets b WHERE b.user_id = c.user_id)
        )::int AS reached_first_bet,
        COUNT(DISTINCT c.user_id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM gammbler_scores gs
            WHERE gs.user_id = c.user_id AND gs.sport = 'overall' AND gs.is_unlocked = true
          )
        )::int AS reached_score_unlock,
        COUNT(DISTINCT c.user_id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM gammbler_scores gs
            WHERE gs.user_id = c.user_id AND gs.sport = 'overall' AND gs.is_unlocked = true
          )
          AND EXISTS (
            SELECT 1 FROM bets b
            WHERE b.user_id = c.user_id AND b.created_at >= NOW() - INTERVAL '14 days'
          )
        )::int AS became_asb,
        COUNT(DISTINCT c.user_id) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM users u2
            WHERE u2.id = c.user_id AND u2.subscription_status = 'active'
          )
        )::int AS became_pro
      FROM cohorts c
      GROUP BY c.cohort_week, c.weeks_since_signup
    )
    SELECT * FROM cohort_metrics
    ORDER BY cohort_week DESC
  `);

  const rows = (results.rows ?? results) as unknown as Record<string, unknown>[];
  return rows.map((r) => {
    const signups = (r.signups as number) || 1;
    return {
      cohortWeek: r.cohort_week as string,
      signups: r.signups as number,
      reachedFirstBet: r.reached_first_bet as number,
      reachedFirstBetPct: Math.round(((r.reached_first_bet as number) / signups) * 10000) / 100,
      reachedScoreUnlock: r.reached_score_unlock as number,
      reachedScoreUnlockPct: Math.round(((r.reached_score_unlock as number) / signups) * 10000) / 100,
      becameASB: r.became_asb as number,
      becameASBPct: Math.round(((r.became_asb as number) / signups) * 10000) / 100,
      becamePro: r.became_pro as number,
      becameProPct: Math.round(((r.became_pro as number) / signups) * 10000) / 100,
      weeksSinceSignup: r.weeks_since_signup as number,
    };
  });
}

export async function getCohortTrend(): Promise<{
  improving: boolean;
  recentASBRate: number;
  previousASBRate: number;
  change: number;
}> {
  const cohorts = await getWeeklyCohorts(8);

  // Compare last 4 weeks vs previous 4 weeks
  // Only look at cohorts old enough to have matured (3+ weeks)
  const mature = cohorts.filter((c) => c.weeksSinceSignup >= 3);
  if (mature.length < 4) {
    return { improving: false, recentASBRate: 0, previousASBRate: 0, change: 0 };
  }

  const sortedByDate = [...mature].sort((a, b) =>
    new Date(b.cohortWeek).getTime() - new Date(a.cohortWeek).getTime()
  );

  const recent = sortedByDate.slice(0, Math.min(4, sortedByDate.length));
  const previous = sortedByDate.slice(Math.min(4, sortedByDate.length));

  const recentASBRate = recent.length > 0
    ? recent.reduce((sum, c) => sum + c.becameASBPct, 0) / recent.length
    : 0;
  const previousASBRate = previous.length > 0
    ? previous.reduce((sum, c) => sum + c.becameASBPct, 0) / previous.length
    : 0;

  return {
    improving: recentASBRate > previousASBRate,
    recentASBRate: Math.round(recentASBRate * 100) / 100,
    previousASBRate: Math.round(previousASBRate * 100) / 100,
    change: Math.round((recentASBRate - previousASBRate) * 100) / 100,
  };
}
