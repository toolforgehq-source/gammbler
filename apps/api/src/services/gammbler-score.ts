import { db } from '../db';
import { bets, gammblerScores } from '../db/schema';
import { eq, and, inArray, sql, ne } from 'drizzle-orm';
import {
  Sport,
  SCORE_WEIGHTS,
  RECENCY_WEIGHTS,
  MIN_BETS_TO_UNLOCK,
  MAX_DAILY_SCORE_DROP,
} from '@gammbler/shared';

interface BetRow {
  id: string;
  result: string;
  odds: string;
  stake: string;
  profit_loss: string | null;
  settled_at: Date | null;
  closing_odds: string | null;
  sport: string;
}

interface WeightedBet extends BetRow {
  weight: number;
}

function getRecencyWeight(settledAt: Date | null): number {
  if (!settledAt) return 0;
  const now = new Date();
  const daysDiff = (now.getTime() - settledAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff <= 30) return RECENCY_WEIGHTS.LAST_30_DAYS;
  if (daysDiff <= 90) return RECENCY_WEIGHTS.DAYS_31_90;
  if (daysDiff <= 180) return RECENCY_WEIGHTS.DAYS_91_180;
  return RECENCY_WEIGHTS.OLDER;
}

function calculateWinRate(weightedBets: WeightedBet[]): number {
  const totalWeight = weightedBets.reduce((sum, b) => sum + b.weight, 0);
  if (totalWeight === 0) return 0;

  const winWeight = weightedBets
    .filter((b) => b.result === 'win')
    .reduce((sum, b) => sum + b.weight, 0);

  return winWeight / totalWeight;
}

function calculateROI(weightedBets: WeightedBet[]): number {
  const totalWeightedStake = weightedBets.reduce(
    (sum, b) => sum + parseFloat(b.stake) * b.weight,
    0
  );
  if (totalWeightedStake === 0) return 0;

  const totalWeightedPL = weightedBets.reduce(
    (sum, b) => sum + parseFloat(b.profit_loss || '0') * b.weight,
    0
  );

  return totalWeightedPL / totalWeightedStake;
}

function calculateCLV(weightedBets: WeightedBet[]): number {
  const betsWithClosing = weightedBets.filter(
    (b) => b.closing_odds !== null && b.closing_odds !== undefined
  );
  if (betsWithClosing.length === 0) return 0;

  const totalWeight = betsWithClosing.reduce((sum, b) => sum + b.weight, 0);
  if (totalWeight === 0) return 0;

  const beatCount = betsWithClosing
    .filter((b) => {
      const openOdds = parseFloat(b.odds);
      const closeOdds = parseFloat(b.closing_odds!);
      // For favorites (negative odds), getting a better number means less negative
      // For underdogs (positive odds), getting a better number means more positive
      if (openOdds < 0) {
        return closeOdds < openOdds; // line moved more negative = we got CLV
      }
      return closeOdds < openOdds; // line shortened = we got value
    })
    .reduce((sum, b) => sum + b.weight, 0);

  return beatCount / totalWeight;
}

function calculateStakeConsistency(weightedBets: WeightedBet[]): number {
  if (weightedBets.length < 3) return 1;

  const stakes = weightedBets.map((b) => parseFloat(b.stake));
  const mean = stakes.reduce((s, v) => s + v, 0) / stakes.length;
  if (mean === 0) return 1;

  const variance = stakes.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / stakes.length;
  const cv = Math.sqrt(variance) / mean;

  // CV of 0 = perfect consistency (score 1), CV >= 2 = very erratic (score 0)
  return Math.max(0, Math.min(1, 1 - cv / 2));
}

function calculateVolume(settledCount: number): number {
  // Scale from 0 to 1 — 500+ bets = max volume score
  return Math.min(1, settledCount / 500);
}

function calculateDiversity(sportsBetOn: Set<string>): number {
  // Betting on 6+ sports = max diversity score
  return Math.min(1, sportsBetOn.size / 6);
}

function normalizeToScore(raw: number, min: number, max: number): number {
  return Math.max(0, Math.min(100, ((raw - min) / (max - min)) * 100));
}

export async function calculateGammblerScore(
  userId: string,
  sport: Sport
): Promise<{ score: number; components: Record<string, number>; settledCount: number }> {
  // Fetch all settled bets for this user — exclude manual_unverified from scoring
  const allSettledBets = await db
    .select()
    .from(bets)
    .where(
      and(
        eq(bets.user_id, userId),
        inArray(bets.result, ['win', 'loss', 'push']),
        sql`COALESCE(${bets.trust_status}, 'synced_verified') != 'manual_unverified'`
      )
    );

  // Filter bets for the specific sport (or all for overall)
  const sportBets = sport === Sport.OVERALL
    ? allSettledBets
    : allSettledBets.filter((b) => b.sport === sport);

  const settledCount = sportBets.length;

  if (settledCount < MIN_BETS_TO_UNLOCK) {
    return {
      score: 0,
      components: { win_rate: 0, roi: 0, clv: 0, stake_consistency: 0, volume: 0, diversity: 0 },
      settledCount,
    };
  }

  // Apply recency weighting
  const weightedBets: WeightedBet[] = sportBets.map((b) => ({
    ...b,
    odds: String(b.odds),
    stake: String(b.stake),
    profit_loss: b.profit_loss ? String(b.profit_loss) : null,
    closing_odds: b.closing_odds ? String(b.closing_odds) : null,
    weight: getRecencyWeight(b.settled_at),
  }));

  // Calculate each component
  const winRate = calculateWinRate(weightedBets);
  const roi = calculateROI(weightedBets);
  const clv = calculateCLV(weightedBets);
  const stakeConsistency = calculateStakeConsistency(weightedBets);
  const volume = calculateVolume(settledCount);

  // Diversity: count unique sports bet on (only applies to overall)
  const sportsBetOn = new Set(allSettledBets.map((b) => b.sport));
  const diversity = calculateDiversity(sportsBetOn);

  // Normalize each factor to 0–100 scale
  const winRateScore = normalizeToScore(winRate, 0.35, 0.65); // 35% win rate = 0, 65% = 100
  const roiScore = normalizeToScore(roi, -0.15, 0.25); // -15% ROI = 0, 25% = 100
  const clvScore = normalizeToScore(clv, 0.3, 0.7); // 30% beat CLV = 0, 70% = 100
  const stakeScore = stakeConsistency * 100;
  const volumeScore = volume * 100;
  const diversityScore = diversity * 100;

  // Apply weights
  let finalScore: number;
  if (sport === Sport.OVERALL) {
    finalScore =
      winRateScore * SCORE_WEIGHTS.WIN_RATE +
      roiScore * SCORE_WEIGHTS.ROI +
      clvScore * SCORE_WEIGHTS.CLV +
      stakeScore * SCORE_WEIGHTS.STAKE_CONSISTENCY +
      volumeScore * SCORE_WEIGHTS.VOLUME +
      diversityScore * SCORE_WEIGHTS.DIVERSITY;
  } else {
    // For individual sports, diversity weight redistributed to win rate and ROI
    const extraWeight = SCORE_WEIGHTS.DIVERSITY / 2;
    finalScore =
      winRateScore * (SCORE_WEIGHTS.WIN_RATE + extraWeight) +
      roiScore * (SCORE_WEIGHTS.ROI + extraWeight) +
      clvScore * SCORE_WEIGHTS.CLV +
      stakeScore * SCORE_WEIGHTS.STAKE_CONSISTENCY +
      volumeScore * SCORE_WEIGHTS.VOLUME;
  }

  // Clamp to 0–100 with one decimal place
  finalScore = Math.round(Math.max(0, Math.min(100, finalScore)) * 10) / 10;

  return {
    score: finalScore,
    components: {
      win_rate: Math.round(winRateScore * 10) / 10,
      roi: Math.round(roiScore * 10) / 10,
      clv: Math.round(clvScore * 10) / 10,
      stake_consistency: Math.round(stakeScore * 10) / 10,
      volume: Math.round(volumeScore * 10) / 10,
      diversity: Math.round(diversityScore * 10) / 10,
    },
    settledCount,
  };
}

export async function updateAllScores(userId: string): Promise<void> {
  const sports = Object.values(Sport);

  for (const sport of sports) {
    const { score, components, settledCount } = await calculateGammblerScore(userId, sport);
    const isUnlocked = settledCount >= MIN_BETS_TO_UNLOCK;

    // Get existing score for daily drop cap
    const existing = await db
      .select()
      .from(gammblerScores)
      .where(and(eq(gammblerScores.user_id, userId), eq(gammblerScores.sport, sport)))
      .limit(1);

    let adjustedScore = score;
    if (existing.length > 0 && isUnlocked) {
      const prevScore = parseFloat(String(existing[0].score));
      const drop = prevScore - score;
      if (drop > MAX_DAILY_SCORE_DROP) {
        adjustedScore = prevScore - MAX_DAILY_SCORE_DROP;
      }
    }

    const values = {
      user_id: userId,
      sport: sport,
      score: String(adjustedScore),
      win_rate: String(components.win_rate),
      roi: String(components.roi),
      clv: String(components.clv),
      stake_consistency: String(components.stake_consistency),
      volume_score: String(components.volume),
      diversity_score: String(components.diversity),
      settled_bet_count: settledCount,
      is_unlocked: isUnlocked,
      calculated_at: new Date(),
      previous_score: existing.length > 0 ? String(existing[0].score) : null,
      score_change_today: existing.length > 0
        ? String(adjustedScore - parseFloat(String(existing[0].score)))
        : '0',
    };

    await db
      .insert(gammblerScores)
      .values(values)
      .onConflictDoUpdate({
        target: [gammblerScores.user_id, gammblerScores.sport],
        set: {
          score: values.score,
          win_rate: values.win_rate,
          roi: values.roi,
          clv: values.clv,
          stake_consistency: values.stake_consistency,
          volume_score: values.volume_score,
          diversity_score: values.diversity_score,
          settled_bet_count: values.settled_bet_count,
          is_unlocked: values.is_unlocked,
          calculated_at: values.calculated_at,
          previous_score: values.previous_score,
          score_change_today: values.score_change_today,
        },
      });
  }
}
