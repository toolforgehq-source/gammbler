import { db } from '../db';
import { dfsContests, dfsScores } from '../db/schema';
import { eq, and, sql, gte } from 'drizzle-orm';

const DFS_SPORTS = ['nfl', 'nba', 'mlb', 'nhl', 'pga', 'nascar', 'soccer', 'mma', 'cfb', 'cbb'] as const;
const MIN_CONTESTS_TO_UNLOCK = 20;

// Weights for DFS Score calculation
const WEIGHTS = {
  roi: 0.40,
  cash_rate: 0.25,
  consistency: 0.20,
  volume: 0.10,
  diversity: 0.05,
};

interface ContestRow {
  entry_fee_cents: number;
  payout_cents: number;
  contest_type: string;
  sport: string;
  contest_date: Date;
}

function calculateRoiComponent(contests: ContestRow[]): number {
  const totalFees = contests.reduce((s, c) => s + c.entry_fee_cents, 0);
  if (totalFees === 0) return 0;
  const totalPayouts = contests.reduce((s, c) => s + c.payout_cents, 0);
  const roi = ((totalPayouts - totalFees) / totalFees) * 100;

  // Scale ROI to 0-100: -50% or worse = 0, +30% or better = 100
  if (roi <= -50) return 0;
  if (roi >= 30) return 100;
  return ((roi + 50) / 80) * 100;
}

function calculateCashRate(contests: ContestRow[]): number {
  if (contests.length === 0) return 0;
  const cashed = contests.filter((c) => c.payout_cents > 0).length;
  const rate = (cashed / contests.length) * 100;

  // Scale: 0% cash rate = 0, 60%+ = 100
  if (rate >= 60) return 100;
  return (rate / 60) * 100;
}

function calculateConsistency(contests: ContestRow[]): number {
  if (contests.length < 4) return 0;

  // Group contests by week
  const weeklyResults: Map<string, { fees: number; payouts: number }> = new Map();
  for (const c of contests) {
    const date = new Date(c.contest_date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    const existing = weeklyResults.get(key) || { fees: 0, payouts: 0 };
    existing.fees += c.entry_fee_cents;
    existing.payouts += c.payout_cents;
    weeklyResults.set(key, existing);
  }

  if (weeklyResults.size < 2) return 0;

  // Calculate weekly ROIs
  const weeklyRois: number[] = [];
  for (const [, week] of weeklyResults) {
    if (week.fees > 0) {
      weeklyRois.push(((week.payouts - week.fees) / week.fees) * 100);
    }
  }

  if (weeklyRois.length < 2) return 0;

  // Profitable weeks percentage
  const profitableWeeks = weeklyRois.filter((r) => r > 0).length;
  const profitPct = (profitableWeeks / weeklyRois.length) * 100;

  // Low variance = more consistent
  const mean = weeklyRois.reduce((s, r) => s + r, 0) / weeklyRois.length;
  const variance = weeklyRois.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / weeklyRois.length;
  const stdDev = Math.sqrt(variance);

  // Low std dev (< 20) = high consistency, high std dev (> 80) = low
  const varianceScore = stdDev <= 20 ? 100 : stdDev >= 80 ? 0 : ((80 - stdDev) / 60) * 100;

  return profitPct * 0.6 + varianceScore * 0.4;
}

function calculateVolume(totalContests: number): number {
  // 0 contests = 0, 200+ = 100
  if (totalContests >= 200) return 100;
  return (totalContests / 200) * 100;
}

function calculateDiversity(contests: ContestRow[]): number {
  if (contests.length === 0) return 0;

  // Count unique contest types and sports
  const contestTypes = new Set(contests.map((c) => c.contest_type));
  const sports = new Set(contests.map((c) => c.sport));

  // Max 7 contest types, max 10 sports
  const typeScore = Math.min(contestTypes.size / 4, 1) * 100;
  const sportScore = Math.min(sports.size / 3, 1) * 100;

  return typeScore * 0.5 + sportScore * 0.5;
}

export async function calculateDfsScore(userId: string): Promise<void> {
  // Fetch all contests for this user
  const allContests = await db
    .select({
      entry_fee_cents: dfsContests.entry_fee_cents,
      payout_cents: dfsContests.payout_cents,
      contest_type: dfsContests.contest_type,
      sport: dfsContests.sport,
      contest_date: dfsContests.contest_date,
    })
    .from(dfsContests)
    .where(eq(dfsContests.user_id, userId));

  if (allContests.length === 0) return;

  const contestRows: ContestRow[] = allContests.map((c) => ({
    entry_fee_cents: c.entry_fee_cents,
    payout_cents: c.payout_cents,
    contest_type: c.contest_type,
    sport: c.sport,
    contest_date: new Date(c.contest_date),
  }));

  // Calculate overall DFS score
  await upsertDfsScore(userId, 'overall', contestRows);

  // Calculate per-sport DFS scores
  for (const sport of DFS_SPORTS) {
    const sportContests = contestRows.filter((c) => c.sport === sport);
    if (sportContests.length > 0) {
      await upsertDfsScore(userId, sport, sportContests);
    }
  }
}

async function upsertDfsScore(
  userId: string,
  sport: string,
  contests: ContestRow[],
): Promise<void> {
  const roiComponent = calculateRoiComponent(contests);
  const cashRateComponent = calculateCashRate(contests);
  const consistencyComponent = calculateConsistency(contests);
  const volumeComponent = calculateVolume(contests.length);
  const diversityComponent = calculateDiversity(contests);

  const rawScore =
    roiComponent * WEIGHTS.roi +
    cashRateComponent * WEIGHTS.cash_rate +
    consistencyComponent * WEIGHTS.consistency +
    volumeComponent * WEIGHTS.volume +
    diversityComponent * WEIGHTS.diversity;

  const score = Math.round(Math.min(100, Math.max(0, rawScore)) * 10) / 10;
  const isUnlocked = contests.length >= MIN_CONTESTS_TO_UNLOCK;

  const totalFees = contests.reduce((s, c) => s + c.entry_fee_cents, 0);
  const totalPayouts = contests.reduce((s, c) => s + c.payout_cents, 0);
  const roi = totalFees > 0 ? ((totalPayouts - totalFees) / totalFees) : 0;
  const cashRate = contests.length > 0
    ? contests.filter((c) => c.payout_cents > 0).length / contests.length
    : 0;

  // Check for existing score to track previous
  const [existing] = await db
    .select({ score: dfsScores.score })
    .from(dfsScores)
    .where(and(eq(dfsScores.user_id, userId), eq(dfsScores.sport, sport as any)))
    .limit(1);

  const previousScore = existing ? existing.score : null;
  const scoreChange = previousScore ? (score - Number(previousScore)) : 0;

  await db
    .insert(dfsScores)
    .values({
      user_id: userId,
      sport: sport as any,
      score: String(score),
      roi: String(Math.round(roi * 10000) / 10000),
      cash_rate: String(Math.round(cashRate * 10000) / 10000),
      consistency: String(Math.round(consistencyComponent * 100) / 10000),
      volume_score: String(Math.round(volumeComponent * 100) / 10000),
      diversity_score: String(Math.round(diversityComponent * 100) / 10000),
      total_contests: contests.length,
      total_entry_fees_cents: totalFees,
      total_payouts_cents: totalPayouts,
      is_unlocked: isUnlocked,
      calculated_at: new Date(),
      previous_score: previousScore,
      score_change_today: String(Math.round(scoreChange * 10) / 10),
    })
    .onConflictDoUpdate({
      target: [dfsScores.user_id, dfsScores.sport],
      set: {
        score: String(score),
        roi: String(Math.round(roi * 10000) / 10000),
        cash_rate: String(Math.round(cashRate * 10000) / 10000),
        consistency: String(Math.round(consistencyComponent * 100) / 10000),
        volume_score: String(Math.round(volumeComponent * 100) / 10000),
        diversity_score: String(Math.round(diversityComponent * 100) / 10000),
        total_contests: contests.length,
        total_entry_fees_cents: totalFees,
        total_payouts_cents: totalPayouts,
        is_unlocked: isUnlocked,
        calculated_at: new Date(),
        previous_score: previousScore,
        score_change_today: String(Math.round(scoreChange * 10) / 10),
      },
    });
}
