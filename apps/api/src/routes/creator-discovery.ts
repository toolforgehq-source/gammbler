import { Router, Request, Response } from 'express';
import { db } from '../db';
import { capperProfiles, users, follows, creatorPosts, gammblerScores, creatorBadges } from '../db/schema';
import { eq, desc, sql, and, gte, inArray } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /creator-discovery?section=trending|growing|new|subscribers|followers&sport=nfl&limit=10
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const section = (req.query.section as string) || 'trending';
    const sport = req.query.sport as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    let creators: any[] = [];

    if (section === 'trending') {
      // Trending: most engagement in last 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      creators = await db
        .select({
          user_id: capperProfiles.user_id,
          username: users.username,
          display_name: capperProfiles.display_name,
          bio: capperProfiles.bio,
          profile_photo_url: capperProfiles.profile_photo_url,
          total_subscribers: capperProfiles.total_subscribers,
          total_followers: capperProfiles.total_followers,
          betting_style: capperProfiles.betting_style,
          favorite_sports: capperProfiles.favorite_sports,
          recent_engagement: sql<number>`coalesce((
            SELECT sum(cp.like_count + cp.comment_count)::int
            FROM creator_posts cp
            WHERE cp.user_id = ${capperProfiles.user_id}
            AND cp.created_at >= ${sevenDaysAgo}
          ), 0)`,
        })
        .from(capperProfiles)
        .innerJoin(users, eq(users.id, capperProfiles.user_id))
        .orderBy(sql`coalesce((
          SELECT sum(cp.like_count + cp.comment_count)::int
          FROM creator_posts cp
          WHERE cp.user_id = ${capperProfiles.user_id}
          AND cp.created_at >= ${sevenDaysAgo}
        ), 0) desc`)
        .limit(limit);

      creators = creators.map((c, i) => ({ ...c, rank: i + 1, metric_value: c.recent_engagement, metric_label: 'Recent Engagements' }));

    } else if (section === 'growing') {
      // Fastest Growing: most new followers in 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      creators = await db
        .select({
          user_id: capperProfiles.user_id,
          username: users.username,
          display_name: capperProfiles.display_name,
          bio: capperProfiles.bio,
          profile_photo_url: capperProfiles.profile_photo_url,
          total_subscribers: capperProfiles.total_subscribers,
          total_followers: capperProfiles.total_followers,
          betting_style: capperProfiles.betting_style,
          favorite_sports: capperProfiles.favorite_sports,
          new_followers: sql<number>`coalesce((
            SELECT count(*)::int FROM follows f
            WHERE f.following_id = ${capperProfiles.user_id}
            AND f.created_at >= ${thirtyDaysAgo}
          ), 0)`,
        })
        .from(capperProfiles)
        .innerJoin(users, eq(users.id, capperProfiles.user_id))
        .orderBy(sql`coalesce((
          SELECT count(*)::int FROM follows f
          WHERE f.following_id = ${capperProfiles.user_id}
          AND f.created_at >= ${thirtyDaysAgo}
        ), 0) desc`)
        .limit(limit);

      creators = creators.map((c, i) => ({ ...c, rank: i + 1, metric_value: c.new_followers, metric_label: 'New Followers (30d)' }));

    } else if (section === 'new') {
      // New Creators: most recently joined
      creators = await db
        .select({
          user_id: capperProfiles.user_id,
          username: users.username,
          display_name: capperProfiles.display_name,
          bio: capperProfiles.bio,
          profile_photo_url: capperProfiles.profile_photo_url,
          total_subscribers: capperProfiles.total_subscribers,
          total_followers: capperProfiles.total_followers,
          betting_style: capperProfiles.betting_style,
          favorite_sports: capperProfiles.favorite_sports,
          created_at: capperProfiles.created_at,
        })
        .from(capperProfiles)
        .innerJoin(users, eq(users.id, capperProfiles.user_id))
        .orderBy(desc(capperProfiles.created_at))
        .limit(limit);

      creators = creators.map((c, i) => ({ ...c, rank: i + 1, metric_value: 'New', metric_label: 'Just Joined' }));

    } else if (section === 'subscribers') {
      creators = await db
        .select({
          user_id: capperProfiles.user_id,
          username: users.username,
          display_name: capperProfiles.display_name,
          bio: capperProfiles.bio,
          profile_photo_url: capperProfiles.profile_photo_url,
          total_subscribers: capperProfiles.total_subscribers,
          total_followers: capperProfiles.total_followers,
          betting_style: capperProfiles.betting_style,
          favorite_sports: capperProfiles.favorite_sports,
        })
        .from(capperProfiles)
        .innerJoin(users, eq(users.id, capperProfiles.user_id))
        .orderBy(desc(capperProfiles.total_subscribers))
        .limit(limit);

      creators = creators.map((c, i) => ({ ...c, rank: i + 1, metric_value: c.total_subscribers, metric_label: 'Subscribers' }));

    } else if (section === 'followers') {
      creators = await db
        .select({
          user_id: capperProfiles.user_id,
          username: users.username,
          display_name: capperProfiles.display_name,
          bio: capperProfiles.bio,
          profile_photo_url: capperProfiles.profile_photo_url,
          total_subscribers: capperProfiles.total_subscribers,
          total_followers: capperProfiles.total_followers,
          betting_style: capperProfiles.betting_style,
          favorite_sports: capperProfiles.favorite_sports,
        })
        .from(capperProfiles)
        .innerJoin(users, eq(users.id, capperProfiles.user_id))
        .orderBy(desc(capperProfiles.total_followers))
        .limit(limit);

      creators = creators.map((c, i) => ({ ...c, rank: i + 1, metric_value: c.total_followers, metric_label: 'Followers' }));
    }

    // Filter by sport if specified
    if (sport && creators.length > 0) {
      creators = creators.filter((c) => {
        const sports = Array.isArray(c.favorite_sports) ? c.favorite_sports : [];
        return sports.some((s: string) => s.toLowerCase() === sport.toLowerCase());
      });
    }

    // Attach betting scores
    const userIds = creators.map((c) => c.user_id);
    if (userIds.length > 0) {
      const scores = await db
        .select({
          user_id: gammblerScores.user_id,
          score: gammblerScores.score,
        })
        .from(gammblerScores)
        .where(and(inArray(gammblerScores.user_id, userIds), eq(gammblerScores.sport, 'overall')));

      const scoreMap = new Map(scores.map((s) => [s.user_id, parseFloat(String(s.score))]));

      // Attach badges
      const badgeRows = await db
        .select({ user_id: creatorBadges.user_id, badge_id: creatorBadges.badge_id })
        .from(creatorBadges)
        .where(inArray(creatorBadges.user_id, userIds));

      const badgeMap = new Map<string, string[]>();
      for (const row of badgeRows) {
        if (!badgeMap.has(row.user_id)) badgeMap.set(row.user_id, []);
        badgeMap.get(row.user_id)!.push(row.badge_id);
      }

      // Check verified status
      const verifiedUsers = await db
        .select({
          id: users.id,
          verified_score_pass: users.verified_score_pass,
          subscription_status: users.subscription_status,
        })
        .from(users)
        .where(inArray(users.id, userIds));

      const verifiedMap = new Map(verifiedUsers.map((u) => [
        u.id,
        u.verified_score_pass || u.subscription_status === 'active',
      ]));

      creators = creators.map((c) => ({
        ...c,
        betting_score: scoreMap.get(c.user_id) || null,
        creator_badges: badgeMap.get(c.user_id) || [],
        is_verified: verifiedMap.get(c.user_id) || false,
      }));
    }

    res.json({ creators, section });
  } catch (err) {
    console.error('Creator discovery error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
