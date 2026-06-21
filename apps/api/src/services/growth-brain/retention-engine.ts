import { db } from '../../db';
import { users, bets, gammblerScores } from '../../db/schema';
import { sql } from 'drizzle-orm';
import { getBelief } from './belief-engine';
import { createOpportunity } from './opportunity-engine';
import { env } from '../../config/env';

const BRAND_URL = env.FRONTEND_URL || 'https://gammbler.com';

interface ChurnRiskUser {
  userId: string;
  username: string;
  email: string;
  score: number;
  daysSinceLastBet: number;
  totalBets: number;
  subscriptionStatus: string;
  riskLevel: 'high' | 'critical';
}

export async function findChurnRiskUsers(): Promise<ChurnRiskUser[]> {
  const results = await db.execute(sql`
    SELECT
      u.id AS user_id,
      u.username,
      u.email,
      gs.score::numeric AS score,
      u.subscription_status,
      bc.total_bets,
      EXTRACT(DAY FROM NOW() - bc.last_bet_at)::int AS days_since_last_bet
    FROM users u
    JOIN gammbler_scores gs ON gs.user_id = u.id AND gs.sport = 'overall' AND gs.is_unlocked = true
    JOIN (
      SELECT user_id, COUNT(*)::int AS total_bets, MAX(created_at) AS last_bet_at
      FROM bets
      GROUP BY user_id
    ) bc ON bc.user_id = u.id
    WHERE bc.last_bet_at < NOW() - INTERVAL '14 days'
    ORDER BY gs.score DESC
  `);

  const rows = (results.rows ?? results) as unknown as Record<string, unknown>[];
  return rows.map((r) => {
    const daysSince = r.days_since_last_bet as number;
    return {
      userId: r.user_id as string,
      username: r.username as string,
      email: r.email as string,
      score: Number(r.score),
      daysSinceLastBet: daysSince,
      totalBets: r.total_bets as number,
      subscriptionStatus: r.subscription_status as string,
      riskLevel: daysSince >= 30 ? 'critical' as const : 'high' as const,
    };
  });
}

export async function generateRetentionOpportunities(): Promise<number> {
  const churnUsers = await findChurnRiskUsers();
  if (churnUsers.length === 0) return 0;

  const reactivationBelief = await getBelief('retention.14_day_dormancy.reactivation_rate');
  const reactivationRate = reactivationBelief?.value ?? 0.15;
  const confidence = reactivationBelief?.confidence ?? 0.10;

  let created = 0;

  for (const user of churnUsers) {
    // Higher-score users are more valuable to reactivate
    const valueMultiplier = Math.min(2.0, user.score / 50);

    // Critical users (30+ days) have lower reactivation probability
    const pSuccess = user.riskLevel === 'critical'
      ? reactivationRate * 0.5
      : reactivationRate;

    const expectedASBs = pSuccess * valueMultiplier;

    // Higher urgency for recently-lapsed users
    const urgency = user.riskLevel === 'critical' ? 0.8 : 1.3;

    const content = generateRetentionEmail(user);

    await createOpportunity({
      actionType: 'retention_campaign',
      channel: 'email',
      whyThis: `${user.username} was an Active Scored Bettor (score: ${user.score}) but hasn't bet in ${user.daysSinceLastBet} days. Former ASBs reactivate at ${Math.round(reactivationRate * 100)}% with nudges (n=${reactivationBelief?.sampleSize ?? 0}).`,
      whyNow: user.riskLevel === 'critical'
        ? `${user.daysSinceLastBet} days inactive. After 45 days, reactivation drops to near zero.`
        : `${user.daysSinceLastBet} days inactive. The 14-30 day window is the best chance to recover this ASB.`,
      evidence: {
        score: user.score,
        daysSinceLastBet: user.daysSinceLastBet,
        totalBets: user.totalBets,
        riskLevel: user.riskLevel,
        reactivationRate,
        sampleSize: reactivationBelief?.sampleSize ?? 0,
        confidence,
      },
      expectedASBs,
      pSuccess,
      confidence,
      urgency,
      costDollars: 0,
      founderTimeMinutes: 1,
      successCriteria: `${user.username} logs a bet within 14 days of receiving the re-engagement email.`,
      learningObjective: `Does re-engagement email recover ${user.riskLevel}-risk ASBs? Update retention.${user.daysSinceLastBet >= 30 ? '30_day' : '14_day'}_dormancy.reactivation_rate belief.`,
      content,
      targetType: 'user',
      targetId: user.userId,
      targetMetadata: {
        username: user.username,
        email: user.email,
        score: user.score,
        daysSinceLastBet: user.daysSinceLastBet,
        riskLevel: user.riskLevel,
      },
      measurementWindowDays: 14,
    });

    created++;
  }

  console.log(`[Growth Brain] Generated ${created} retention opportunities`);
  return created;
}

function generateRetentionEmail(user: ChurnRiskUser): Record<string, unknown> {
  const { username, score, daysSinceLastBet } = user;

  if (daysSinceLastBet >= 30) {
    return {
      subject: `${username}, your Gammbler Score is at risk`,
      body: `It's been ${daysSinceLastBet} days since your last bet. Your score (${score}) will become stale without new data.\n\nThe leaderboard has been moving. Come back and reclaim your spot.\n\n${BRAND_URL}/dashboard`,
      tone: 'urgent',
    };
  }

  // Competitive trigger for 14-29 day lapse
  return {
    subject: `${username}, the leaderboard moved while you were away`,
    body: `It's been ${daysSinceLastBet} days. Other bettors have been climbing.\n\nYour score: ${score}. Come back and prove it wasn't a fluke.\n\n${BRAND_URL}/dashboard/leaderboards`,
    tone: 'competitive',
  };
}
