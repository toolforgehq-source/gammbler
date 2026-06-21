import { db } from '../../db';
import { users, gammblerScores, bets, badges } from '../../db/schema';
import { eq, and, sql, gte, desc } from 'drizzle-orm';
import { getBelief, upsertBelief } from './belief-engine';
import { createOpportunity } from './opportunity-engine';
import { env } from '../../config/env';

const BRAND_URL = env.FRONTEND_URL || 'https://gammbler.com';

interface ReferralMoment {
  userId: string;
  username: string;
  email: string;
  referralCode: string;
  momentType: string;
  momentDetail: string;
  score: number | null;
}

export async function detectReferralMoments(): Promise<ReferralMoment[]> {
  const days3Ago = new Date();
  days3Ago.setDate(days3Ago.getDate() - 3);

  const moments: ReferralMoment[] = [];

  // Score unlock moments (freshly unlocked in last 3 days)
  const scoreUnlocksResult = await db.execute(sql`
    SELECT u.id AS user_id, u.username, u.email, u.referral_code, gs.score
    FROM gammbler_scores gs
    JOIN users u ON u.id = gs.user_id
    WHERE gs.sport = 'overall'
      AND gs.is_unlocked = true
      AND gs.calculated_at >= ${days3Ago}
      AND gs.settled_bet_count BETWEEN 10 AND 12
  `);

  const scoreUnlockRows = (scoreUnlocksResult.rows ?? scoreUnlocksResult) as unknown as Record<string, unknown>[];
  for (const row of scoreUnlockRows) {
    moments.push({
      userId: row.user_id as string,
      username: row.username as string,
      email: row.email as string,
      referralCode: row.referral_code as string,
      momentType: 'score_unlock',
      momentDetail: `Just unlocked their Gammbler Score: ${row.score}`,
      score: row.score as number | null,
    });
  }

  // Badge earned moments (last 3 days)
  const newBadgesResult = await db.execute(sql`
    SELECT u.id AS user_id, u.username, u.email, u.referral_code,
           b.badge_type, gs.score
    FROM badges b
    JOIN users u ON u.id = b.user_id
    LEFT JOIN gammbler_scores gs ON gs.user_id = u.id AND gs.sport = 'overall'
    WHERE b.earned_at >= ${days3Ago}
      AND b.badge_type IN ('sharp_shooter', 'elite_status', 'legend', 'profitable_month', 'hot_streak', 'on_fire')
  `);

  const newBadgeRows = (newBadgesResult.rows ?? newBadgesResult) as unknown as Record<string, unknown>[];
  for (const row of newBadgeRows) {
    moments.push({
      userId: row.user_id as string,
      username: row.username as string,
      email: row.email as string,
      referralCode: row.referral_code as string,
      momentType: 'badge_earned',
      momentDetail: `Earned ${row.badge_type} badge`,
      score: row.score as number | null,
    });
  }

  // Win streak detection (3+ consecutive wins in last 3 days)
  const streaksResult = await db.execute(sql`
    WITH recent_bets AS (
      SELECT user_id, result, settled_at,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY settled_at DESC) AS rn
      FROM bets
      WHERE result IN ('win', 'loss')
        AND settled_at >= ${days3Ago}
    ),
    streak_check AS (
      SELECT user_id, COUNT(*) AS streak
      FROM recent_bets
      WHERE result = 'win' AND rn <= 5
      GROUP BY user_id
      HAVING COUNT(*) >= 3
    )
    SELECT u.id AS user_id, u.username, u.email, u.referral_code,
           sc.streak, gs.score
    FROM streak_check sc
    JOIN users u ON u.id = sc.user_id
    LEFT JOIN gammbler_scores gs ON gs.user_id = u.id AND gs.sport = 'overall'
  `);

  const streakRows = (streaksResult.rows ?? streaksResult) as unknown as Record<string, unknown>[];
  for (const row of streakRows) {
    moments.push({
      userId: row.user_id as string,
      username: row.username as string,
      email: row.email as string,
      referralCode: row.referral_code as string,
      momentType: 'win_streak',
      momentDetail: `On a ${row.streak}-win streak`,
      score: row.score as number | null,
    });
  }

  return moments;
}

export async function generateReferralOpportunities(): Promise<number> {
  const moments = await detectReferralMoments();
  if (moments.length === 0) return 0;

  const referralBelief = await getBelief('referral.milestone_triggered.referral_rate');
  const referralRate = referralBelief?.value ?? 0.08;
  const confidence = referralBelief?.confidence ?? 0.10;

  const asbConversionBelief = await getBelief('funnel.signup_to_first_bet');
  const signupToASBRate = (asbConversionBelief?.value ?? 0.20) * 0.5;

  let created = 0;

  for (const moment of moments) {
    const pSuccess = referralRate;
    const expectedReferrals = 1.5;
    const expectedASBs = expectedReferrals * signupToASBRate;

    const urgencyByType: Record<string, number> = {
      score_unlock: 1.5,
      badge_earned: 1.2,
      win_streak: 1.3,
    };

    const content = generateReferralEmail(moment);

    await createOpportunity({
      actionType: 'referral_campaign',
      channel: 'email',
      whyThis: `${moment.username} just hit a milestone (${moment.momentDetail}). Users at emotional highs refer at ${Math.round(referralRate * 100)}% (n=${referralBelief?.sampleSize ?? 0}).`,
      whyNow: `Milestone happened in the last 3 days. Referral probability decays rapidly after 72 hours.`,
      evidence: {
        momentType: moment.momentType,
        momentDetail: moment.momentDetail,
        referralRate,
        sampleSize: referralBelief?.sampleSize ?? 0,
        confidence,
      },
      expectedASBs,
      pSuccess,
      confidence,
      urgency: urgencyByType[moment.momentType] ?? 1.0,
      costDollars: 0,
      founderTimeMinutes: 1,
      successCriteria: `${moment.username} shares their referral code and at least 1 referred user becomes an ASB.`,
      learningObjective: `Does the "${moment.momentType}" milestone trigger referrals? Update referral.${moment.momentType}.referral_rate belief.`,
      content,
      targetType: 'user',
      targetId: moment.userId,
      targetMetadata: {
        username: moment.username,
        email: moment.email,
        momentType: moment.momentType,
        referralCode: moment.referralCode,
        score: moment.score,
      },
      measurementWindowDays: 30,
    });

    created++;
  }

  console.log(`[Growth Brain] Generated ${created} referral opportunities`);
  return created;
}

function generateReferralEmail(moment: ReferralMoment): Record<string, unknown> {
  const { username, momentType, momentDetail, referralCode, score } = moment;

  if (momentType === 'score_unlock') {
    return {
      subject: `${username}, you just unlocked your Gammbler Score`,
      body: `Your score is ${score}. Think your friends can beat it?\n\nShare your referral code: ${referralCode}\nYou both get 3 extra days of Pro.\n\n${BRAND_URL}/signup?ref=${referralCode}`,
    };
  }

  if (momentType === 'win_streak') {
    return {
      subject: `${username}, you're on fire`,
      body: `${momentDetail}. That's worth bragging about.\n\nChallenge your friends to join and prove they can keep up.\nReferral code: ${referralCode}\n\n${BRAND_URL}/signup?ref=${referralCode}`,
    };
  }

  return {
    subject: `${username}, you just earned an achievement`,
    body: `${momentDetail}. Share the moment with your friends.\n\nReferral code: ${referralCode}\nYou both get 3 extra days of Pro.\n\n${BRAND_URL}/signup?ref=${referralCode}`,
  };
}

export async function computeViralCoefficient(): Promise<{
  k: number;
  invitationsPerUser: number;
  conversionPerInvitation: number;
  totalUsers: number;
  referredUsers: number;
}> {
  const dataResult = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS total_users,
      (SELECT COUNT(*)::int FROM users WHERE referred_by IS NOT NULL) AS referred_users,
      (SELECT COUNT(DISTINCT referred_by)::int FROM users WHERE referred_by IS NOT NULL) AS users_who_referred
  `);

  const d = (dataResult.rows?.[0] ?? dataResult) as Record<string, number>;
  const totalUsers = d.total_users || 1;
  const referredUsers = d.referred_users || 0;
  const usersWhoReferred = d.users_who_referred || 0;

  // K = (invitations_per_user) * (conversion_per_invitation)
  // Approximation: invitations_per_user = referred_users / users_who_referred (avg referrals per referrer)
  // Then scale by what fraction of users even refer at all
  const referralParticipationRate = usersWhoReferred / totalUsers;
  const avgReferralsPerReferrer = usersWhoReferred > 0 ? referredUsers / usersWhoReferred : 0;

  const invitationsPerUser = referralParticipationRate * avgReferralsPerReferrer;
  const conversionPerInvitation = 1; // Each referral IS a conversion (they signed up)

  const k = invitationsPerUser * conversionPerInvitation;

  return {
    k,
    invitationsPerUser,
    conversionPerInvitation,
    totalUsers,
    referredUsers,
  };
}
