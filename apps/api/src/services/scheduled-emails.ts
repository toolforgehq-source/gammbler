import { db } from '../db';
import { users, bets, gammblerScores, notifications } from '../db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import {
  sendWeeklyReportEmail,
} from './email';

// ── Weekly report emails ─────────────────────────────────────

export async function sendWeeklyReports(): Promise<void> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get all users who haven't cancelled (free + pro both get weekly reports)
  const activeUsers = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      notification_preferences: users.notification_preferences,
    })
    .from(users)
    .where(
      sql`${users.subscription_status} NOT IN ('cancelled')`
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
