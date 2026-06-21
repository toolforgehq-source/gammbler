import { db } from '../../db';
import { users, bets, gammblerScores } from '../../db/schema';
import { eq, and, sql, lt, gte, not } from 'drizzle-orm';
import { getBelief, upsertBelief } from './belief-engine';
import { createOpportunity } from './opportunity-engine';
import { env } from '../../config/env';

const BRAND_URL = env.FRONTEND_URL || 'https://gammbler.com';

interface StuckUser {
  userId: string;
  username: string;
  email: string;
  betCount: number;
  betsNeeded: number;
  lastBetAt: Date | null;
  daysSinceSignup: number;
  daysSinceLastBet: number | null;
}

export async function findStuckUsers(): Promise<StuckUser[]> {
  const days30Ago = new Date();
  days30Ago.setDate(days30Ago.getDate() - 30);

  const results = await db.execute(sql`
    SELECT
      u.id AS user_id,
      u.username,
      u.email,
      COALESCE(bc.bet_count, 0)::int AS bet_count,
      (10 - COALESCE(bc.bet_count, 0))::int AS bets_needed,
      bc.last_bet_at,
      EXTRACT(DAY FROM NOW() - u.created_at)::int AS days_since_signup,
      CASE WHEN bc.last_bet_at IS NOT NULL
        THEN EXTRACT(DAY FROM NOW() - bc.last_bet_at)::int
        ELSE NULL
      END AS days_since_last_bet
    FROM users u
    LEFT JOIN (
      SELECT
        user_id,
        COUNT(*)::int AS bet_count,
        MAX(created_at) AS last_bet_at
      FROM bets
      GROUP BY user_id
    ) bc ON bc.user_id = u.id
    LEFT JOIN gammbler_scores gs ON gs.user_id = u.id AND gs.sport = 'overall'
    WHERE (gs.is_unlocked IS NULL OR gs.is_unlocked = false)
      AND COALESCE(bc.bet_count, 0) BETWEEN 1 AND 9
      AND u.created_at >= ${days30Ago}
    ORDER BY bc.bet_count DESC
  `);

  const rows = (results.rows ?? results) as unknown as Record<string, unknown>[];
  return rows.map((r) => ({
    userId: r.user_id as string,
    username: r.username as string,
    email: r.email as string,
    betCount: r.bet_count as number,
    betsNeeded: r.bets_needed as number,
    lastBetAt: r.last_bet_at ? new Date(r.last_bet_at as string) : null,
    daysSinceSignup: r.days_since_signup as number,
    daysSinceLastBet: r.days_since_last_bet as number | null,
  }));
}

export async function generateOnboardingOpportunities(): Promise<number> {
  const stuckUsers = await findStuckUsers();
  if (stuckUsers.length === 0) return 0;

  const activationBelief = await getBelief('onboarding.3_plus_bets.activation_rate');
  const activationRate = activationBelief?.value ?? 0.30;
  const confidence = activationBelief?.confidence ?? 0.10;

  let created = 0;

  for (const user of stuckUsers) {
    // Users closer to 10 bets are higher probability
    const progressMultiplier = user.betCount / 10;
    const pSuccess = activationRate * (0.5 + progressMultiplier * 0.5);

    // More recent users are higher urgency
    const recencyUrgency = user.daysSinceLastBet !== null
      ? Math.max(0.3, 1 - (user.daysSinceLastBet / 30))
      : 0.5;

    const expectedASBs = pSuccess;

    const emailContent = generateNudgeEmail(user);

    await createOpportunity({
      actionType: 'onboarding_nudge',
      channel: 'email',
      whyThis: `${user.username} has ${user.betCount} bets and needs ${user.betsNeeded} more to unlock their Gammbler Score. Users in this cohort activate at ${Math.round(activationRate * 100)}% (n=${activationBelief?.sampleSize ?? 0}).`,
      whyNow: user.daysSinceLastBet !== null
        ? `Last bet was ${user.daysSinceLastBet} days ago. Re-engagement drops significantly after 14 days of inactivity.`
        : `User signed up ${user.daysSinceSignup} days ago but momentum is stalling.`,
      evidence: {
        betCount: user.betCount,
        betsNeeded: user.betsNeeded,
        daysSinceLastBet: user.daysSinceLastBet,
        activationRate,
        sampleSize: activationBelief?.sampleSize ?? 0,
        confidence,
      },
      expectedASBs,
      pSuccess,
      confidence,
      urgency: recencyUrgency,
      costDollars: 0,
      founderTimeMinutes: 1,
      successCriteria: `${user.username} logs ${user.betsNeeded} more bets and unlocks their score within 14 days.`,
      learningObjective: `Does nudging users with ${user.betCount} bets increase activation rate? Update onboarding.${user.betCount}_bets.activation_rate belief.`,
      content: emailContent,
      targetType: 'user',
      targetId: user.userId,
      targetMetadata: {
        username: user.username,
        email: user.email,
        betCount: user.betCount,
        betsNeeded: user.betsNeeded,
      },
      measurementWindowDays: 14,
    });

    created++;
  }

  console.log(`[Growth Brain] Generated ${created} onboarding nudge opportunities`);
  return created;
}

function generateNudgeEmail(user: StuckUser): Record<string, unknown> {
  const { username, betCount, betsNeeded } = user;

  if (betCount >= 7) {
    return {
      subject: `${username}, you're ${betsNeeded} bets away from your Gammbler Score`,
      body: `You're almost there. ${betsNeeded} more settled bets and your Gammbler Score unlocks. You'll see exactly where you rank nationally.\n\nAdd your next bet: ${BRAND_URL}/dashboard/add-bet`,
      tone: 'urgent',
    };
  }

  if (betCount >= 4) {
    return {
      subject: `Your score is building, ${username}`,
      body: `You've logged ${betCount} bets so far. Just ${betsNeeded} more to unlock your Gammbler Score and see how you rank against every bettor in the country.\n\nKeep going: ${BRAND_URL}/dashboard/add-bet`,
      tone: 'encouraging',
    };
  }

  return {
    subject: `${username}, your betting track record is waiting`,
    body: `You've started with ${betCount} bets. Log ${betsNeeded} more to unlock your Gammbler Score — a 0-100 rating that proves how good you really are.\n\nNo more guessing: ${BRAND_URL}/dashboard/add-bet`,
    tone: 'motivational',
  };
}

export async function generateOnboardingEmails(): Promise<{
  day: number;
  subject: string;
  trigger: string;
}[]> {
  // These are the drip emails that should be configured in SendGrid or scheduled
  return [
    {
      day: 2,
      subject: 'Connect your sportsbook — auto-import every bet',
      trigger: 'user.created_at + 2 days AND sportsbook_connections.count = 0',
    },
    {
      day: 3,
      subject: 'You\'re {{bets_needed}} bets away from your Gammbler Score',
      trigger: 'user.created_at + 3 days AND bet_count < 10',
    },
    {
      day: 5,
      subject: 'See how you compare — explore the leaderboard',
      trigger: 'user.created_at + 5 days',
    },
    {
      day: 7,
      subject: 'Challenge a friend to a H2H bet',
      trigger: 'user.created_at + 7 days AND challenges.count = 0',
    },
    {
      day: 10,
      subject: 'Your score is almost ready! Just {{bets_needed}} more bets',
      trigger: 'user.created_at + 10 days AND bet_count >= 3 AND bet_count < 10',
    },
  ];
}
