import { Router, Request, Response } from 'express';
import { db } from '../db';
import { capperProfiles, users, follows, creatorPosts, gammblerScores } from '../db/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /creator-leaderboards?category=subscribers|followers|growing|engaged&limit=50&offset=0
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const category = (req.query.category as string) || 'subscribers';
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    let leaderboard: any[] = [];

    if (category === 'subscribers') {
      // Most Subscribers — total active subscribers
      const results = await db
        .select({
          user_id: capperProfiles.user_id,
          username: users.username,
          avatar_url: users.avatar_url,
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
        .where(eq(capperProfiles.status, 'active'))
        .orderBy(desc(capperProfiles.total_subscribers))
        .limit(limit)
        .offset(offset);

      leaderboard = results.map((r, i) => ({
        rank: offset + i + 1,
        ...r,
        metric_value: r.total_subscribers,
        metric_label: 'Subscribers',
      }));

    } else if (category === 'followers') {
      // Most Followed — total followers
      const results = await db
        .select({
          user_id: capperProfiles.user_id,
          username: users.username,
          avatar_url: users.avatar_url,
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
        .where(eq(capperProfiles.status, 'active'))
        .orderBy(desc(capperProfiles.total_followers))
        .limit(limit)
        .offset(offset);

      leaderboard = results.map((r, i) => ({
        rank: offset + i + 1,
        ...r,
        metric_value: r.total_followers,
        metric_label: 'Followers',
      }));

    } else if (category === 'growing') {
      // Fastest Growing — new followers in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const results = await db
        .select({
          user_id: capperProfiles.user_id,
          username: users.username,
          avatar_url: users.avatar_url,
          display_name: capperProfiles.display_name,
          bio: capperProfiles.bio,
          profile_photo_url: capperProfiles.profile_photo_url,
          total_subscribers: capperProfiles.total_subscribers,
          total_followers: capperProfiles.total_followers,
          betting_style: capperProfiles.betting_style,
          favorite_sports: capperProfiles.favorite_sports,
          new_followers: sql<number>`(
            SELECT count(*)::int FROM follows
            WHERE follows.following_id = ${capperProfiles.user_id}
            AND follows.created_at >= ${thirtyDaysAgo.toISOString()}
          )`.as('new_followers'),
        })
        .from(capperProfiles)
        .innerJoin(users, eq(users.id, capperProfiles.user_id))
        .where(eq(capperProfiles.status, 'active'))
        .orderBy(sql`(
          SELECT count(*)::int FROM follows
          WHERE follows.following_id = ${capperProfiles.user_id}
          AND follows.created_at >= ${thirtyDaysAgo.toISOString()}
        ) DESC`)
        .limit(limit)
        .offset(offset);

      leaderboard = results.map((r, i) => ({
        rank: offset + i + 1,
        ...r,
        metric_value: r.new_followers || 0,
        metric_label: 'New Followers (30d)',
      }));

    } else if (category === 'engaged') {
      // Most Engaged — total likes + comments on their posts
      const results = await db
        .select({
          user_id: capperProfiles.user_id,
          username: users.username,
          avatar_url: users.avatar_url,
          display_name: capperProfiles.display_name,
          bio: capperProfiles.bio,
          profile_photo_url: capperProfiles.profile_photo_url,
          total_subscribers: capperProfiles.total_subscribers,
          total_followers: capperProfiles.total_followers,
          betting_style: capperProfiles.betting_style,
          favorite_sports: capperProfiles.favorite_sports,
          total_engagement: sql<number>`(
            SELECT COALESCE(SUM(creator_posts.like_count + creator_posts.comment_count), 0)::int
            FROM creator_posts
            WHERE creator_posts.user_id = ${capperProfiles.user_id}
          )`.as('total_engagement'),
        })
        .from(capperProfiles)
        .innerJoin(users, eq(users.id, capperProfiles.user_id))
        .where(eq(capperProfiles.status, 'active'))
        .orderBy(sql`(
          SELECT COALESCE(SUM(creator_posts.like_count + creator_posts.comment_count), 0)::int
          FROM creator_posts
          WHERE creator_posts.user_id = ${capperProfiles.user_id}
        ) DESC`)
        .limit(limit)
        .offset(offset);

      leaderboard = results.map((r, i) => ({
        rank: offset + i + 1,
        ...r,
        metric_value: r.total_engagement || 0,
        metric_label: 'Engagements',
      }));

    } else {
      res.status(400).json({ error: 'Invalid category. Use: subscribers, followers, growing, engaged' });
      return;
    }

    // Attach betting scores for each creator
    const userIds = leaderboard.map((l) => l.user_id);
    if (userIds.length > 0) {
      const scores = await db
        .select({
          user_id: gammblerScores.user_id,
          score: gammblerScores.score,
          is_unlocked: gammblerScores.is_unlocked,
        })
        .from(gammblerScores)
        .where(
          and(
            sql`${gammblerScores.user_id} = ANY(${userIds})`,
            eq(gammblerScores.sport, 'overall')
          )
        );

      const scoreMap = new Map(scores.map((s) => [s.user_id, s]));
      leaderboard = leaderboard.map((entry) => {
        const scoreData = scoreMap.get(entry.user_id);
        return {
          ...entry,
          betting_score: scoreData?.is_unlocked ? parseFloat(scoreData.score as string) : null,
          score_unlocked: scoreData?.is_unlocked || false,
        };
      });
    }

    res.json({ leaderboard, category });
  } catch (err) {
    console.error('Creator leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
