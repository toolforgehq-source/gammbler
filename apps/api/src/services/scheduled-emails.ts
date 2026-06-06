import { db } from '../db';
import { users, bets, gammblerScores, notifications } from '../db/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import {
  sendTrialEndingEmail,
  sendTrialEndedEmail,
  sendWeeklyReportEmail,
} from './email';

// ── Trial reminder emails ────────────────────────────────────

export async function checkTrialReminders(): Promise<void> {
  const now = new Date();

  // Find users whose trial ends in exactly 1 day (within a 1-hour window)
  const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const oneDayWindowEnd = new Date(oneDayFromNow.getTime() + 60 * 60 * 1000);

  const trialEnding1Day = await db
    .select({ email: users.email, username: users.username })
    .from(users)
    .where(
      and(
        eq(users.subscription_status, 'trialing'),
        gte(users.trial_ends_at, oneDayFromNow),
        lte(users.trial_ends_at, oneDayWindowEnd)
      )
    );

  for (const user of trialEnding1Day) {
    await sendTrialEndingEmail(user.email, user.username, 1);
  }

  // Find users whose trial ends in exactly 3 days (within a 1-hour window)
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const threeDaysWindowEnd = new Date(threeDaysFromNow.getTime() + 60 * 60 * 1000);

  const trialEnding3Days = await db
    .select({ email: users.email, username: users.username })
    .from(users)
    .where(
      and(
        eq(users.subscription_status, 'trialing'),
        gte(users.trial_ends_at, threeDaysFromNow),
        lte(users.trial_ends_at, threeDaysWindowEnd)
      )
    );

  for (const user of trialEnding3Days) {
    await sendTrialEndingEmail(user.email, user.username, 3);
  }

  // Find users whose trial just ended (within the last hour)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  const trialJustEnded = await db
    .select({ email: users.email, username: users.username })
    .from(users)
    .where(
      and(
        eq(users.subscription_status, 'trialing'),
        gte(users.trial_ends_at, oneHourAgo),
        lte(users.trial_ends_at, now)
      )
    );

  for (const user of trialJustEnded) {
    await sendTrialEndedEmail(user.email, user.username);
  }

  if (trialEnding1Day.length + trialEnding3Days.length + trialJustEnded.length > 0) {
    console.log(`[Cron] Trial reminders: ${trialEnding3Days.length} at 3 days, ${trialEnding1Day.length} at 1 day, ${trialJustEnded.length} ended`);
  }
}

// ── Weekly report emails ─────────────────────────────────────

export async function sendWeeklyReports(): Promise<void> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get all active/trialing users who have at least 1 bet
  const activeUsers = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      notification_preferences: users.notification_preferences,
    })
    .from(users)
    .where(
      sql`${users.subscription_status} IN ('active', 'trialing')`
    );

  let sent = 0;

  for (const user of activeUsers) {
    try {
      // Check if user has disabled weekly reports
      const prefs = (user.notification_preferences || {}) as Record<string, boolean>;
      if (prefs.weekly_report === false) continue;

      // Get this week's bets
      const weekBets = await db
        .select()
        .from(bets)
        .where(
          and(
            eq(bets.user_id, user.id),
            gte(bets.created_at, oneWeekAgo)
          )
        );

      // Skip users with no activity this week
      if (weekBets.length === 0) continue;

      const settled = weekBets.filter((b) => ['win', 'loss', 'push'].includes(b.result));
      const wins = settled.filter((b) => b.result === 'win').length;
      const losses = settled.filter((b) => b.result === 'loss').length;
      const pushes = settled.filter((b) => b.result === 'push').length;
      const totalStake = settled.reduce((s, b) => s + parseFloat(String(b.stake)), 0);
      const totalPL = settled.reduce((s, b) => s + parseFloat(String(b.profit_loss || '0')), 0);
      const roi = totalStake > 0 ? Math.round((totalPL / totalStake) * 10000) / 100 : 0;

      // Get scores
      const scores = await db
        .select()
        .from(gammblerScores)
        .where(eq(gammblerScores.user_id, user.id));

      const overallScore = scores.find((s) => s.sport === 'overall');
      const overallScoreVal = overallScore ? String(overallScore.score) : '0.0';

      // Find best sport (highest score, excluding overall)
      const sportScores = scores.filter((s) => s.sport !== 'overall' && parseFloat(String(s.score)) > 0);
      sportScores.sort((a, b) => parseFloat(String(b.score)) - parseFloat(String(a.score)));
      const bestSport = sportScores[0];

      // Get national rank (approximate: count users with higher overall score)
      const [rankResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(gammblerScores)
        .where(
          and(
            eq(gammblerScores.sport, 'overall'),
            sql`${gammblerScores.score} > ${overallScoreVal}`
          )
        );
      const nationalRank = (rankResult?.count || 0) + 1;

      await sendWeeklyReportEmail(user.email, user.username, {
        overallScore: overallScoreVal,
        scoreChange: '0.0', // Would need historical scores to compute delta
        betsThisWeek: weekBets.length,
        record: `${wins}-${losses}${pushes > 0 ? `-${pushes}` : ''}`,
        roi: String(roi),
        bestSport: bestSport ? bestSport.sport.toUpperCase() : 'N/A',
        bestSportScore: bestSport ? String(bestSport.score) : '0',
        nationalRank,
      });

      // Create in-app notification too
      await db.insert(notifications).values({
        user_id: user.id,
        type: 'weekly_report',
        title: 'Weekly Report',
        body: `Your weekly report is ready. Score: ${overallScoreVal}, Record: ${wins}-${losses}, ROI: ${roi}%`,
      });

      sent++;
    } catch (err) {
      console.error(`[Cron] Failed to send weekly report to ${user.email}:`, err);
    }
  }

  console.log(`[Cron] Sent ${sent} weekly report emails`);
}
