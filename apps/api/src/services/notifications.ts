import webpush from 'web-push';
import { db } from '../db';
import { notifications, pushSubscriptions, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';
import {
  sendChallengeReceivedEmail,
  sendChallengeResultEmail,
  sendNewFollowerEmail,
  sendScoreChangeEmail,
  sendLeaderboardPassedEmail,
} from './email';

// ── VAPID setup ──────────────────────────────────────────────

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(env.VAPID_EMAIL, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}

// ── Types ────────────────────────────────────────────────────

type NotificationType =
  | 'challenge_received'
  | 'challenge_accepted'
  | 'challenge_settled'
  | 'new_follower'
  | 'score_change'
  | 'rank_milestone'
  | 'leaderboard_passed'
  | 'creator_post'
  | 'badge_earned'
  | 'league_invite';

interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Notification preference keys map to types
const PREF_MAP: Record<NotificationType, string> = {
  challenge_received: 'challenges',
  challenge_accepted: 'challenges',
  challenge_settled: 'challenges',
  new_follower: 'social',
  score_change: 'score',
  rank_milestone: 'score',
  leaderboard_passed: 'score',
  creator_post: 'creators',
  badge_earned: 'achievements',
  league_invite: 'leagues',
};

// ── Core: create notification + email + push ─────────────────

export async function notify(payload: NotificationPayload): Promise<void> {
  try {
    const { userId, type, title, body, data } = payload;

    // Check user preferences
    const [user] = await db
      .select({
        notification_preferences: users.notification_preferences,
        email: users.email,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return;

    const prefs = (user.notification_preferences || {}) as Record<string, unknown>;
    const prefKey = PREF_MAP[type];

    // If user explicitly disabled this category, skip entirely
    if (prefs[`${prefKey}_enabled`] === false) return;

    // 1. Insert DB notification
    await db.insert(notifications).values({
      user_id: userId,
      type,
      title,
      body,
      data: data || {},
    });

    // 2. Send email (unless user disabled email for this category)
    if (prefs[`${prefKey}_email`] !== false) {
      sendNotificationEmail(user.email, user.username, payload).catch(() => {});
    }

    // 3. Send browser push (unless user disabled push for this category)
    if (prefs[`${prefKey}_push`] !== false) {
      sendPushNotification(userId, title, body, data).catch(() => {});
    }
  } catch (err) {
    console.error('[Notify] Error:', err);
  }
}

// ── Email dispatcher ─────────────────────────────────────────

async function sendNotificationEmail(
  email: string,
  username: string,
  payload: NotificationPayload,
): Promise<void> {
  const { type, data } = payload;

  switch (type) {
    case 'challenge_received':
      await sendChallengeReceivedEmail(
        email,
        username,
        (data?.challenger_username as string) || 'Someone',
        (data?.event_name as string) || '',
        (data?.challenger_pick as string) || '',
        (data?.sport as string) || '',
      );
      break;

    case 'challenge_settled':
      await sendChallengeResultEmail(
        email,
        username,
        (data?.is_winner as boolean) || false,
        (data?.opponent_username as string) || '',
        (data?.event_name as string) || '',
      );
      break;

    case 'new_follower':
      await sendNewFollowerEmail(
        email,
        username,
        (data?.follower_username as string) || '',
      );
      break;

    case 'score_change':
      await sendScoreChangeEmail(
        email,
        username,
        (data?.sport as string) || 'overall',
        (data?.old_score as string) || '0',
        (data?.new_score as string) || '0',
      );
      break;

    case 'rank_milestone':
    case 'leaderboard_passed':
      await sendLeaderboardPassedEmail(
        email,
        username,
        (data?.passer_username as string) || 'Someone',
        (data?.sport as string) || 'overall',
        (data?.new_rank as number) || 0,
      );
      break;

    // challenge_accepted, creator_post, badge_earned, league_invite
    // use the generic title/body — no special email template needed
    default:
      break;
  }
}

// ── Browser push ─────────────────────────────────────────────

async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.user_id, userId));

  const pushPayload = JSON.stringify({
    title,
    body,
    icon: '/images/logo-icon.png',
    badge: '/images/logo-icon.png',
    data: { url: data?.url || '/dashboard/notifications', ...data },
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushPayload,
      );
    } catch (err: any) {
      // If subscription expired/invalid, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
    }
  }
}

// ── Convenience helpers ──────────────────────────────────────

export async function notifyChallengeReceived(
  challengeeId: string,
  challengerUsername: string,
  eventName: string,
  challengerPick: string,
  sport: string,
  challengeId: string,
): Promise<void> {
  await notify({
    userId: challengeeId,
    type: 'challenge_received',
    title: `${challengerUsername} challenged you!`,
    body: `H2H on ${eventName} (${sport.toUpperCase()})`,
    data: {
      challenger_username: challengerUsername,
      event_name: eventName,
      challenger_pick: challengerPick,
      sport,
      challenge_id: challengeId,
      url: '/dashboard/challenges',
    },
  });
}

export async function notifyChallengeAccepted(
  challengerId: string,
  challengeeUsername: string,
  eventName: string,
  challengeId: string,
): Promise<void> {
  await notify({
    userId: challengerId,
    type: 'challenge_accepted',
    title: `${challengeeUsername} accepted your challenge!`,
    body: `H2H on ${eventName} — game on.`,
    data: {
      challengee_username: challengeeUsername,
      event_name: eventName,
      challenge_id: challengeId,
      url: '/dashboard/challenges',
    },
  });
}

export async function notifyChallengeSettled(
  userId: string,
  isWinner: boolean,
  opponentUsername: string,
  eventName: string,
  challengeId: string,
): Promise<void> {
  await notify({
    userId,
    type: 'challenge_settled',
    title: isWinner ? `You won vs ${opponentUsername}!` : `Challenge settled vs ${opponentUsername}`,
    body: isWinner ? `You won the H2H on ${eventName}.` : `You lost the H2H on ${eventName}.`,
    data: {
      is_winner: isWinner,
      opponent_username: opponentUsername,
      event_name: eventName,
      challenge_id: challengeId,
      url: '/dashboard/challenges',
    },
  });
}

export async function notifyNewFollower(
  followedUserId: string,
  followerUsername: string,
): Promise<void> {
  await notify({
    userId: followedUserId,
    type: 'new_follower',
    title: `${followerUsername} followed you`,
    body: 'Check out their profile.',
    data: {
      follower_username: followerUsername,
      url: `/dashboard/profile/${followerUsername}`,
    },
  });
}

export async function notifyScoreMilestone(
  userId: string,
  sport: string,
  oldScore: number,
  newScore: number,
): Promise<void> {
  // Only notify on tier crossings: 60 (Developing), 70 (Sharp), 80 (Elite), 90 (Legend)
  const tiers = [
    { threshold: 90, name: 'Legend' },
    { threshold: 80, name: 'Elite' },
    { threshold: 70, name: 'Sharp' },
    { threshold: 60, name: 'Developing' },
  ];

  for (const tier of tiers) {
    if (oldScore < tier.threshold && newScore >= tier.threshold) {
      const sportDisplay = sport === 'overall' ? 'Overall' : sport.toUpperCase();
      await notify({
        userId,
        type: 'score_change',
        title: `You hit ${newScore.toFixed(1)} — ${tier.name}!`,
        body: `Your ${sportDisplay} score crossed the ${tier.name} threshold.`,
        data: {
          sport,
          old_score: oldScore.toFixed(1),
          new_score: newScore.toFixed(1),
          tier: tier.name,
          url: '/dashboard',
        },
      });
      return;
    }
  }
}

export async function notifyRankMilestone(
  userId: string,
  newRank: number,
  sport: string,
): Promise<void> {
  // Only notify on major milestones: top 10, 25, 50, 100
  const milestones = [10, 25, 50, 100];
  const milestone = milestones.find((m) => newRank <= m);
  if (!milestone) return;

  // Check if this is actually a new milestone (avoid re-notifying)
  const sportDisplay = sport === 'overall' ? 'National' : `${sport.toUpperCase()} National`;
  await notify({
    userId,
    type: 'rank_milestone',
    title: `You're Top ${milestone} ${sportDisplay}!`,
    body: `You're now ranked #${newRank} on the ${sportDisplay} leaderboard.`,
    data: {
      rank: newRank,
      milestone,
      sport,
      url: '/dashboard/leaderboards',
    },
  });
}

export async function notifyCreatorPost(
  followerUserId: string,
  creatorUsername: string,
  postTitle: string,
  postId: string,
): Promise<void> {
  await notify({
    userId: followerUserId,
    type: 'creator_post',
    title: `${creatorUsername} posted new content`,
    body: postTitle || 'New picks available.',
    data: {
      creator_username: creatorUsername,
      post_id: postId,
      url: '/dashboard/creator-feed',
    },
  });
}

export async function notifyLeagueInvite(
  userId: string,
  inviterUsername: string,
  leagueName: string,
  leagueId: string,
): Promise<void> {
  await notify({
    userId,
    type: 'league_invite',
    title: `${inviterUsername} invited you to ${leagueName}`,
    body: 'Join the league and start competing.',
    data: {
      inviter_username: inviterUsername,
      league_name: leagueName,
      league_id: leagueId,
      url: '/dashboard/leagues',
    },
  });
}
