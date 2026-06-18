import { db } from '../db';
import { notifications, users } from '../db/schema';
import { eq } from 'drizzle-orm';

type NotificationType = 'trial_ending_10' | 'trial_ending_13' | 'trial_ended' |
  'weekly_report' | 'badge_earned' | 'leaderboard_passed' |
  'score_change' | 'bet_settled' | 'new_follower';

interface NotificationPrefs {
  achievements?: boolean;
  social?: boolean;
  score?: boolean;
  [key: string]: boolean | undefined;
}

const TYPE_TO_CATEGORY: Record<NotificationType, string> = {
  trial_ending_10: 'score',
  trial_ending_13: 'score',
  trial_ended: 'score',
  weekly_report: 'score',
  badge_earned: 'achievements',
  leaderboard_passed: 'score',
  score_change: 'score',
  bet_settled: 'score',
  new_follower: 'social',
};

async function isOptedOut(userId: string, type: NotificationType): Promise<boolean> {
  const [user] = await db
    .select({ notification_preferences: users.notification_preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return true;

  const prefs = (user.notification_preferences || {}) as NotificationPrefs;
  const category = TYPE_TO_CATEGORY[type];

  if (category && prefs[category] === false) return true;
  return false;
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
): Promise<void> {
  if (await isOptedOut(userId, type)) return;

  await db.insert(notifications).values({
    user_id: userId,
    type,
    title,
    body,
  });
}

export async function notifyBadgeEarned(userId: string, badgeName: string): Promise<void> {
  await createNotification(
    userId,
    'badge_earned',
    'Badge Earned!',
    `You earned the "${badgeName}" badge.`,
  );
}

export async function notifyBetSettled(
  userId: string,
  selection: string,
  result: string,
  profitLoss: string,
): Promise<void> {
  const pl = parseFloat(profitLoss);
  const plStr = pl >= 0 ? `+$${pl.toFixed(2)}` : `-$${Math.abs(pl).toFixed(2)}`;
  await createNotification(
    userId,
    'bet_settled',
    `Bet ${result.charAt(0).toUpperCase() + result.slice(1)}`,
    `${selection} — ${result.toUpperCase()} (${plStr})`,
  );
}

export async function notifyNewFollower(userId: string, followerUsername: string): Promise<void> {
  await createNotification(
    userId,
    'new_follower',
    'New Follower',
    `@${followerUsername} started following you.`,
  );
}

export async function notifyLeaderboardPassed(userId: string, passedBy: string): Promise<void> {
  await createNotification(
    userId,
    'leaderboard_passed',
    'Leaderboard Update',
    `@${passedBy} just passed you on the leaderboard!`,
  );
}

export async function notifyScoreChange(userId: string, oldScore: number, newScore: number): Promise<void> {
  const direction = newScore > oldScore ? 'up' : 'down';
  const diff = Math.abs(newScore - oldScore).toFixed(1);
  await createNotification(
    userId,
    'score_change',
    'Score Updated',
    `Your Gammbler Score went ${direction} by ${diff} points (now ${newScore.toFixed(1)}).`,
  );
}
