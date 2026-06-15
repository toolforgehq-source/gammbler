import { db } from '../db';
import { creatorBadges, capperProfiles, follows, creatorPosts, capperSubscriptions, leagues } from '../db/schema';
import { eq, sql, and, gte } from 'drizzle-orm';

// ── Badge Definitions ─────────────────────────────────────────

export interface CreatorBadgeDef {
  id: string;
  name: string;
  description: string;
  category: 'follower' | 'subscriber' | 'content' | 'recognition' | 'elite';
  icon: string;
}

export const CREATOR_BADGE_DEFS: CreatorBadgeDef[] = [
  // Follower milestones
  { id: 'first_follower', name: 'First Follower', description: 'Gained your first follower', category: 'follower', icon: 'UserPlus' },
  { id: '100_followers', name: '100 Followers', description: 'Reached 100 followers', category: 'follower', icon: 'Users' },
  { id: '500_followers', name: '500 Followers', description: 'Reached 500 followers', category: 'follower', icon: 'Users' },
  { id: '1000_followers', name: '1K Followers', description: 'Reached 1,000 followers', category: 'follower', icon: 'Users' },
  { id: '5000_followers', name: '5K Followers', description: 'Reached 5,000 followers', category: 'follower', icon: 'Users' },

  // Subscriber milestones
  { id: 'first_subscriber', name: 'First Subscriber', description: 'Gained your first paid subscriber', category: 'subscriber', icon: 'Star' },
  { id: '10_subscribers', name: '10 Subscribers', description: 'Reached 10 subscribers', category: 'subscriber', icon: 'Star' },
  { id: '50_subscribers', name: '50 Subscribers', description: 'Reached 50 subscribers', category: 'subscriber', icon: 'Star' },
  { id: '100_subscribers', name: '100 Subscribers', description: 'Reached 100 subscribers', category: 'subscriber', icon: 'Crown' },
  { id: '500_subscribers', name: '500 Subscribers', description: 'Reached 500 subscribers', category: 'subscriber', icon: 'Crown' },

  // Content milestones
  { id: 'first_post', name: 'First Post', description: 'Published your first creator post', category: 'content', icon: 'PenTool' },
  { id: '25_posts', name: '25 Posts', description: 'Published 25 creator posts', category: 'content', icon: 'PenTool' },
  { id: '100_posts', name: '100 Posts', description: 'Published 100 creator posts', category: 'content', icon: 'PenTool' },
  { id: '500_posts', name: '500 Posts', description: 'Published 500 creator posts', category: 'content', icon: 'BookOpen' },

  // Recognition badges
  { id: 'rising_creator', name: 'Rising Creator', description: 'Fast follower and subscriber growth', category: 'recognition', icon: 'TrendingUp' },
  { id: 'community_favorite', name: 'Community Favorite', description: 'High engagement rate relative to audience', category: 'recognition', icon: 'Heart' },
  { id: 'community_builder', name: 'Community Builder', description: 'Consistent posting with strong engagement', category: 'recognition', icon: 'Award' },
  { id: 'league_commissioner', name: 'League Commissioner', description: 'Created and manages leagues', category: 'recognition', icon: 'Shield' },

  // Elite creator badges
  { id: 'top_10_creator', name: 'Top 10 Creator', description: 'Ranked in the top 10 creators by subscribers', category: 'elite', icon: 'Trophy' },
  { id: 'top_creator', name: 'Top Creator', description: 'The #1 creator on Gammbler by subscribers', category: 'elite', icon: 'Crown' },
];

const BADGE_MAP = new Map(CREATOR_BADGE_DEFS.map((b) => [b.id, b]));

export function getCreatorBadgeDef(badgeId: string): CreatorBadgeDef | undefined {
  return BADGE_MAP.get(badgeId);
}

// ── Badge Check & Award ───────────────────────────────────────

export async function checkAndAwardCreatorBadges(userId: string): Promise<string[]> {
  const awarded: string[] = [];

  // Get existing creator badges
  const existing = await db
    .select({ badge_id: creatorBadges.badge_id })
    .from(creatorBadges)
    .where(eq(creatorBadges.user_id, userId));
  const has = new Set(existing.map((b) => b.badge_id));

  // Get capper profile
  const [profile] = await db
    .select()
    .from(capperProfiles)
    .where(eq(capperProfiles.user_id, userId))
    .limit(1);

  if (!profile) return awarded;

  // Follower count
  const [followerResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(eq(follows.following_id, userId));
  const followerCount = followerResult?.count || 0;

  // Subscriber count
  const [subResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(capperSubscriptions)
    .where(and(eq(capperSubscriptions.capper_user_id, userId), eq(capperSubscriptions.status, 'active')));
  const subCount = subResult?.count || 0;

  // Post count
  const [postResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(creatorPosts)
    .where(eq(creatorPosts.user_id, userId));
  const postCount = postResult?.count || 0;

  // Total engagement (likes + comments on all posts)
  const [engageResult] = await db
    .select({ total: sql<number>`coalesce(sum(${creatorPosts.like_count} + ${creatorPosts.comment_count}), 0)::int` })
    .from(creatorPosts)
    .where(eq(creatorPosts.user_id, userId));
  const engagement = engageResult?.total || 0;

  // League count (commissioned by this user)
  const [leagueResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leagues)
    .where(eq(leagues.commissioner_id, userId));
  const leagueCount = leagueResult?.count || 0;

  // Recent follower growth (30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [growthResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(follows)
    .where(and(eq(follows.following_id, userId), gte(follows.created_at, thirtyDaysAgo)));
  const recentGrowth = growthResult?.count || 0;

  // ── Award follower badges ──
  const followerMilestones: [number, string][] = [
    [1, 'first_follower'],
    [100, '100_followers'],
    [500, '500_followers'],
    [1000, '1000_followers'],
    [5000, '5000_followers'],
  ];
  for (const [threshold, badgeId] of followerMilestones) {
    if (followerCount >= threshold && !has.has(badgeId)) {
      await awardBadge(userId, badgeId);
      awarded.push(badgeId);
      has.add(badgeId);
    }
  }

  // ── Award subscriber badges ──
  const subMilestones: [number, string][] = [
    [1, 'first_subscriber'],
    [10, '10_subscribers'],
    [50, '50_subscribers'],
    [100, '100_subscribers'],
    [500, '500_subscribers'],
  ];
  for (const [threshold, badgeId] of subMilestones) {
    if (subCount >= threshold && !has.has(badgeId)) {
      await awardBadge(userId, badgeId);
      awarded.push(badgeId);
      has.add(badgeId);
    }
  }

  // ── Award content badges ──
  const postMilestones: [number, string][] = [
    [1, 'first_post'],
    [25, '25_posts'],
    [100, '100_posts'],
    [500, '500_posts'],
  ];
  for (const [threshold, badgeId] of postMilestones) {
    if (postCount >= threshold && !has.has(badgeId)) {
      await awardBadge(userId, badgeId);
      awarded.push(badgeId);
      has.add(badgeId);
    }
  }

  // ── Recognition badges ──
  // Rising Creator: 10+ new followers in 30 days
  if (recentGrowth >= 10 && !has.has('rising_creator')) {
    await awardBadge(userId, 'rising_creator');
    awarded.push('rising_creator');
    has.add('rising_creator');
  }

  // Community Favorite: 50+ engagement with audience ratio > 2x
  if (engagement >= 50 && followerCount > 0 && (engagement / followerCount) >= 2 && !has.has('community_favorite')) {
    await awardBadge(userId, 'community_favorite');
    awarded.push('community_favorite');
    has.add('community_favorite');
  }

  // Community Builder: 10+ posts AND 20+ engagement
  if (postCount >= 10 && engagement >= 20 && !has.has('community_builder')) {
    await awardBadge(userId, 'community_builder');
    awarded.push('community_builder');
    has.add('community_builder');
  }

  // League Commissioner: created 1+ league
  if (leagueCount >= 1 && !has.has('league_commissioner')) {
    await awardBadge(userId, 'league_commissioner');
    awarded.push('league_commissioner');
    has.add('league_commissioner');
  }

  // ── Elite badges (based on subscriber rank) ──
  const allCappers = await db
    .select({ user_id: capperProfiles.user_id, total_subscribers: capperProfiles.total_subscribers })
    .from(capperProfiles)
    .orderBy(sql`${capperProfiles.total_subscribers} desc`)
    .limit(10);

  const rank = allCappers.findIndex((c) => c.user_id === userId);
  if (rank === 0 && !has.has('top_creator')) {
    await awardBadge(userId, 'top_creator');
    awarded.push('top_creator');
    has.add('top_creator');
  }
  if (rank >= 0 && rank < 10 && !has.has('top_10_creator')) {
    await awardBadge(userId, 'top_10_creator');
    awarded.push('top_10_creator');
    has.add('top_10_creator');
  }

  return awarded;
}

async function awardBadge(userId: string, badgeId: string): Promise<void> {
  await db.insert(creatorBadges).values({
    user_id: userId,
    badge_id: badgeId,
  }).onConflictDoNothing();
}

// ── Get badges for a user ─────────────────────────────────────

export async function getCreatorBadgesForUser(userId: string): Promise<Array<CreatorBadgeDef & { earned_at: Date }>> {
  const userBadges = await db
    .select()
    .from(creatorBadges)
    .where(eq(creatorBadges.user_id, userId));

  return userBadges
    .map((b) => {
      const def = BADGE_MAP.get(b.badge_id);
      if (!def) return null;
      return { ...def, earned_at: b.earned_at };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);
}
