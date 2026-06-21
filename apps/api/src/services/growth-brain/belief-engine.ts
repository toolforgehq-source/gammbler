import { db } from '../../db';
import { growthBeliefs } from '../../db/schema';
import { eq, sql } from 'drizzle-orm';

// Confidence = 1 - 1/sqrt(n+1), capped at 0.95
function computeConfidence(sampleSize: number): number {
  if (sampleSize <= 0) return 0;
  return Math.min(0.95, 1 - 1 / Math.sqrt(sampleSize + 1));
}

export async function upsertBelief(
  key: string,
  newValue: number,
  newSampleSize: number,
  reason: string,
): Promise<void> {
  const confidence = computeConfidence(newSampleSize);

  const existing = await db
    .select()
    .from(growthBeliefs)
    .where(eq(growthBeliefs.belief_key, key))
    .limit(1);

  if (existing.length > 0) {
    const prev = existing[0];
    await db
      .update(growthBeliefs)
      .set({
        previous_value: prev.belief_value,
        previous_sample_size: prev.sample_size,
        belief_value: String(newValue),
        sample_size: newSampleSize,
        confidence: String(confidence),
        updated_reason: reason,
        updated_at: new Date(),
      })
      .where(eq(growthBeliefs.belief_key, key));
  } else {
    await db.insert(growthBeliefs).values({
      belief_key: key,
      belief_value: String(newValue),
      sample_size: newSampleSize,
      confidence: String(confidence),
      updated_reason: reason,
    });
  }
}

export async function getBelief(key: string): Promise<{
  value: number;
  sampleSize: number;
  confidence: number;
} | null> {
  const [row] = await db
    .select()
    .from(growthBeliefs)
    .where(eq(growthBeliefs.belief_key, key))
    .limit(1);

  if (!row) return null;

  return {
    value: Number(row.belief_value),
    sampleSize: row.sample_size,
    confidence: Number(row.confidence),
  };
}

export async function seedBeliefsFromHistoricalData(): Promise<void> {
  // Seed funnel conversion beliefs from actual data
  const funnelResult = await db.execute(sql`
    WITH funnel AS (
      SELECT
        (SELECT COUNT(*)::int FROM users) AS total_users,
        (SELECT COUNT(DISTINCT user_id)::int FROM bets) AS users_with_bets,
        (SELECT COUNT(DISTINCT user_id)::int FROM gammbler_scores WHERE is_unlocked = true AND sport = 'overall') AS users_score_unlocked,
        (SELECT COUNT(*)::int FROM users WHERE subscription_status = 'active') AS pro_users,
        (SELECT COUNT(*)::int FROM capper_profiles WHERE status = 'active') AS creators,
        (SELECT COUNT(DISTINCT user_id)::int FROM users WHERE referred_by IS NOT NULL) AS referred_users
    )
    SELECT * FROM funnel
  `);

  const f = (funnelResult.rows?.[0] ?? funnelResult) as Record<string, number>;

  if (f.total_users > 0) {
    await upsertBelief(
      'funnel.signup_to_first_bet',
      f.users_with_bets / f.total_users,
      f.total_users,
      'Seeded from historical data',
    );
  }

  if (f.users_with_bets > 0) {
    await upsertBelief(
      'funnel.first_bet_to_score_unlock',
      f.users_score_unlocked / f.users_with_bets,
      f.users_with_bets,
      'Seeded from historical data',
    );
  }

  if (f.users_score_unlocked > 0) {
    await upsertBelief(
      'funnel.score_unlock_to_pro',
      f.pro_users / f.users_score_unlocked,
      f.users_score_unlocked,
      'Seeded from historical data',
    );
  }

  if (f.total_users > 0 && f.referred_users > 0) {
    await upsertBelief(
      'referral.signup_rate',
      f.referred_users / f.total_users,
      f.total_users,
      'Seeded from historical referral data',
    );
  }

  // Seed onboarding belief: what % of users with 3-9 bets eventually unlock score
  const onboardingResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS users_3_to_9,
      COUNT(*) FILTER (WHERE gs.is_unlocked = true)::int AS eventually_unlocked
    FROM (
      SELECT user_id, COUNT(*)::int AS bet_count
      FROM bets
      GROUP BY user_id
    ) bc
    LEFT JOIN gammbler_scores gs ON gs.user_id = bc.user_id AND gs.sport = 'overall'
    WHERE bc.bet_count >= 3
  `);

  const ob = (onboardingResult.rows?.[0] ?? onboardingResult) as Record<string, number>;
  if (ob.users_3_to_9 > 0) {
    await upsertBelief(
      'onboarding.3_plus_bets.activation_rate',
      ob.eventually_unlocked / ob.users_3_to_9,
      ob.users_3_to_9,
      'Seeded from historical activation data',
    );
  }

  console.log('[Growth Brain] Beliefs seeded from historical data');
}

export { computeConfidence };
