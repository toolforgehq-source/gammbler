import { db } from '../db';
import { users, bets, gammblerScores, capperProfiles } from '../db/schema';
import { eq, and, sql, gte, inArray } from 'drizzle-orm';

const ACTIVE_WINDOW_DAYS = 14;

export interface ASBStatus {
  userId: string;
  username: string;
  isScoreUnlocked: boolean;
  hasRecentBet: boolean;
  isASB: boolean;
  settledBetCount: number;
  lastBetAt: Date | null;
  score: number | null;
  subscriptionStatus: string;
  createdAt: Date;
  referredBy: string | null;
  utmSource: string | null;
}

export async function isActiveScoredbettor(userId: string): Promise<boolean> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ACTIVE_WINDOW_DAYS);

  const [scoreRow] = await db
    .select({ is_unlocked: gammblerScores.is_unlocked })
    .from(gammblerScores)
    .where(
      and(
        eq(gammblerScores.user_id, userId),
        eq(gammblerScores.sport, 'overall'),
      )
    )
    .limit(1);

  if (!scoreRow?.is_unlocked) return false;

  const [recentBet] = await db
    .select({ id: bets.id })
    .from(bets)
    .where(
      and(
        eq(bets.user_id, userId),
        gte(bets.created_at, cutoff),
      )
    )
    .limit(1);

  return !!recentBet;
}

export interface FunnelCounts {
  totalUsers: number;
  totalWithFirstBet: number;
  totalWithSportsbook: number;
  totalScoreUnlocked: number;
  totalActive14d: number;
  totalActive7d: number;
  totalProSubscribers: number;
  totalCreators: number;
  totalActiveCreators: number;
}

export async function getFunnelCounts(): Promise<FunnelCounts> {
  const now = new Date();
  const days14Ago = new Date(now);
  days14Ago.setDate(days14Ago.getDate() - 14);
  const days7Ago = new Date(now);
  days7Ago.setDate(days7Ago.getDate() - 7);
  const days14AgoCreator = new Date(now);
  days14AgoCreator.setDate(days14AgoCreator.getDate() - 14);

  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS total_users,
      (SELECT COUNT(DISTINCT user_id)::int FROM bets) AS total_with_first_bet,
      (SELECT COUNT(DISTINCT user_id)::int FROM sportsbook_connections) AS total_with_sportsbook,
      (SELECT COUNT(DISTINCT user_id)::int FROM gammbler_scores WHERE is_unlocked = true AND sport = 'overall') AS total_score_unlocked,
      (SELECT COUNT(DISTINCT gs.user_id)::int
       FROM gammbler_scores gs
       WHERE gs.is_unlocked = true AND gs.sport = 'overall'
         AND EXISTS (
           SELECT 1 FROM bets b WHERE b.user_id = gs.user_id AND b.created_at >= ${days14Ago}
         )
      ) AS total_active_14d,
      (SELECT COUNT(DISTINCT gs.user_id)::int
       FROM gammbler_scores gs
       WHERE gs.is_unlocked = true AND gs.sport = 'overall'
         AND EXISTS (
           SELECT 1 FROM bets b WHERE b.user_id = gs.user_id AND b.created_at >= ${days7Ago}
         )
      ) AS total_active_7d,
      (SELECT COUNT(*)::int FROM users WHERE subscription_status = 'active') AS total_pro_subscribers,
      (SELECT COUNT(*)::int FROM capper_profiles WHERE status = 'active') AS total_creators,
      (SELECT COUNT(DISTINCT cp.user_id)::int
       FROM capper_profiles cp
       WHERE cp.status = 'active'
         AND EXISTS (
           SELECT 1 FROM creator_posts p WHERE p.user_id = cp.user_id AND p.created_at >= ${days14AgoCreator}
         )
      ) AS total_active_creators
  `);

  const row = (result.rows?.[0] ?? result) as Record<string, number>;
  return {
    totalUsers: row.total_users ?? 0,
    totalWithFirstBet: row.total_with_first_bet ?? 0,
    totalWithSportsbook: row.total_with_sportsbook ?? 0,
    totalScoreUnlocked: row.total_score_unlocked ?? 0,
    totalActive14d: row.total_active_14d ?? 0,
    totalActive7d: row.total_active_7d ?? 0,
    totalProSubscribers: row.total_pro_subscribers ?? 0,
    totalCreators: row.total_creators ?? 0,
    totalActiveCreators: row.total_active_creators ?? 0,
  };
}

export interface FunnelStage {
  name: string;
  count: number;
  conversionFromPrevious: number | null;
}

export function computeFunnelStages(counts: FunnelCounts): FunnelStage[] {
  const stages: FunnelStage[] = [
    {
      name: 'Signup',
      count: counts.totalUsers,
      conversionFromPrevious: null,
    },
    {
      name: 'First Bet',
      count: counts.totalWithFirstBet,
      conversionFromPrevious: counts.totalUsers > 0
        ? counts.totalWithFirstBet / counts.totalUsers
        : null,
    },
    {
      name: 'Score Unlocked (10+ bets)',
      count: counts.totalScoreUnlocked,
      conversionFromPrevious: counts.totalWithFirstBet > 0
        ? counts.totalScoreUnlocked / counts.totalWithFirstBet
        : null,
    },
    {
      name: 'Active Scored Bettor (14d)',
      count: counts.totalActive14d,
      conversionFromPrevious: counts.totalScoreUnlocked > 0
        ? counts.totalActive14d / counts.totalScoreUnlocked
        : null,
    },
    {
      name: 'Pro Subscriber',
      count: counts.totalProSubscribers,
      conversionFromPrevious: counts.totalActive14d > 0
        ? counts.totalProSubscribers / counts.totalActive14d
        : null,
    },
  ];

  return stages;
}

export interface BiggestDropoff {
  fromStage: string;
  toStage: string;
  dropoffRate: number;
  usersLost: number;
}

export function findBiggestDropoff(stages: FunnelStage[]): BiggestDropoff | null {
  let worstDropoff: BiggestDropoff | null = null;
  let worstRate = 1;

  for (let i = 1; i < stages.length; i++) {
    const conversion = stages[i].conversionFromPrevious;
    if (conversion !== null && conversion < worstRate && stages[i - 1].count > 0) {
      worstRate = conversion;
      worstDropoff = {
        fromStage: stages[i - 1].name,
        toStage: stages[i].name,
        dropoffRate: 1 - conversion,
        usersLost: stages[i - 1].count - stages[i].count,
      };
    }
  }

  return worstDropoff;
}

export async function getNewASBs7d(): Promise<number> {
  const days7Ago = new Date();
  days7Ago.setDate(days7Ago.getDate() - 7);
  const days14Ago = new Date();
  days14Ago.setDate(days14Ago.getDate() - 14);

  // Users whose score was unlocked recently (calculated_at in last 7 days)
  // AND who have a recent bet (active)
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT gs.user_id)::int AS count
    FROM gammbler_scores gs
    WHERE gs.is_unlocked = true
      AND gs.sport = 'overall'
      AND gs.calculated_at >= ${days7Ago}
      AND EXISTS (
        SELECT 1 FROM bets b WHERE b.user_id = gs.user_id AND b.created_at >= ${days14Ago}
      )
  `);

  const row = (result.rows?.[0] ?? result) as Record<string, number>;
  return row.count ?? 0;
}

export async function getChurnedASBs7d(): Promise<number> {
  const days14Ago = new Date();
  days14Ago.setDate(days14Ago.getDate() - 14);
  const days21Ago = new Date();
  days21Ago.setDate(days21Ago.getDate() - 21);

  // Users who had a bet between 15-21 days ago (were active last week's window)
  // but no bet in last 14 days (no longer active)
  // AND have unlocked score
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT gs.user_id)::int AS count
    FROM gammbler_scores gs
    WHERE gs.is_unlocked = true
      AND gs.sport = 'overall'
      AND EXISTS (
        SELECT 1 FROM bets b
        WHERE b.user_id = gs.user_id
          AND b.created_at >= ${days21Ago}
          AND b.created_at < ${days14Ago}
      )
      AND NOT EXISTS (
        SELECT 1 FROM bets b2
        WHERE b2.user_id = gs.user_id AND b2.created_at >= ${days14Ago}
      )
  `);

  const row = (result.rows?.[0] ?? result) as Record<string, number>;
  return row.count ?? 0;
}
