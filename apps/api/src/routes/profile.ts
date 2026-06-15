import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users, gammblerScores, badges, follows, bets, scoreSnapshots } from '../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { attachTier } from '../middleware/subscription';
import { z } from 'zod';
import { sendNewFollowerEmail } from '../services/email';
import { checkAndAwardCreatorBadges } from '../services/creator-badges';
import { notifyNewFollower } from '../services/notifications';

const router = Router();

const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  email: z.string().email().optional(),
  is_profile_public: z.boolean().optional(),
  avatar_url: z.string().url().optional(),
  notification_preferences: z.record(z.boolean()).optional(),
  do_not_disturb_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  do_not_disturb_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

// GET /profile/:username — get public profile
router.get('/:username', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        avatar_url: users.avatar_url,
        created_at: users.created_at,
        is_profile_public: users.is_profile_public,
        verified_score_pass: users.verified_score_pass,
        subscription_status: users.subscription_status,
        trial_ends_at: users.trial_ends_at,
      })
      .from(users)
      .where(eq(users.username, req.params.username))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get scores
    const scores = await db
      .select()
      .from(gammblerScores)
      .where(eq(gammblerScores.user_id, user.id));

    // Get badges
    const userBadges = await db
      .select()
      .from(badges)
      .where(eq(badges.user_id, user.id))
      .orderBy(desc(badges.earned_at));

    // Get follow counts
    const [followerCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.following_id, user.id));

    const [followingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.follower_id, user.id));

    // Check if current user follows this profile
    let isFollowing = false;
    if (req.user) {
      const [follow] = await db
        .select()
        .from(follows)
        .where(
          and(
            eq(follows.follower_id, req.user.userId),
            eq(follows.following_id, user.id)
          )
        )
        .limit(1);
      isFollowing = !!follow;
    }

    // Get overall record
    const allBets = await db
      .select()
      .from(bets)
      .where(eq(bets.user_id, user.id));

    const settled = allBets.filter((b) => ['win', 'loss', 'push'].includes(b.result));
    const record = {
      wins: settled.filter((b) => b.result === 'win').length,
      losses: settled.filter((b) => b.result === 'loss').length,
      pushes: settled.filter((b) => b.result === 'push').length,
    };

    const totalStake = settled.reduce((s, b) => s + parseFloat(String(b.stake)), 0);
    const totalPL = settled.reduce((s, b) => s + parseFloat(String(b.profit_loss || '0')), 0);
    const roi = totalStake > 0 ? Math.round((totalPL / totalStake) * 10000) / 100 : 0;

    const publicProfile: Record<string, unknown> = {
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      is_profile_public: user.is_profile_public,
      scores: scores.map((s) => ({
        sport: s.sport,
        score: s.score,
        is_unlocked: s.is_unlocked,
        settled_bet_count: s.settled_bet_count,
      })),
      badges: userBadges,
      record,
      roi,
      followers: followerCount?.count || 0,
      following: followingCount?.count || 0,
      is_following: isFollowing,
      is_self: req.user?.userId === user.id,
      is_verified: user.verified_score_pass || user.subscription_status === 'active',
    };

    // Add private fields if viewing own profile
    if (req.user?.userId === user.id) {
      publicProfile.total_profit_loss = Math.round(totalPL * 100) / 100;
    }

    res.json({ profile: publicProfile });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /profile — update own profile
router.patch('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = updateProfileSchema.parse(req.body);

    if (body.username) {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.username, body.username))
        .limit(1);
      if (existing.length > 0 && existing[0].id !== req.user!.userId) {
        res.status(409).json({ error: 'Username already taken' });
        return;
      }
    }

    const [updated] = await db
      .update(users)
      .set(body)
      .where(eq(users.id, req.user!.userId))
      .returning();

    res.json({
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        avatar_url: updated.avatar_url,
        is_profile_public: updated.is_profile_public,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /profile/follow/:userId — follow a user
router.post('/follow/:userId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.params.userId === req.user!.userId) {
      res.status(400).json({ error: 'Cannot follow yourself' });
      return;
    }

    await db
      .insert(follows)
      .values({
        follower_id: req.user!.userId,
        following_id: req.params.userId,
      })
      .onConflictDoNothing();

    // Send new follower email (fire & forget)
    const [followedUser] = await db
      .select({ email: users.email, username: users.username })
      .from(users)
      .where(eq(users.id, req.params.userId))
      .limit(1);
    const [followerUser] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);
    if (followedUser && followerUser) {
      notifyNewFollower(req.params.userId, followerUser.username).catch(() => {});
    }

    // Check creator badges for the followed user (fire & forget)
    checkAndAwardCreatorBadges(req.params.userId).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    console.error('Follow error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /profile/follow/:userId — unfollow a user
router.delete('/follow/:userId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    await db
      .delete(follows)
      .where(
        and(
          eq(follows.follower_id, req.user!.userId),
          eq(follows.following_id, req.params.userId)
        )
      );

    res.json({ success: true });
  } catch (err) {
    console.error('Unfollow error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /profile/:username/score-history — get historical Gammbler Score data
router.get('/:username/score-history', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, req.params.username))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const snapshots = await db
      .select({
        sport: scoreSnapshots.sport,
        score: scoreSnapshots.score,
        snapshot_date: scoreSnapshots.snapshot_date,
      })
      .from(scoreSnapshots)
      .where(eq(scoreSnapshots.user_id, user.id))
      .orderBy(scoreSnapshots.snapshot_date);

    // Group by sport
    const history: Record<string, Array<{ date: string; score: number }>> = {};
    for (const snap of snapshots) {
      const sport = snap.sport;
      if (!history[sport]) history[sport] = [];
      history[sport].push({
        date: new Date(snap.snapshot_date).toISOString().slice(0, 10),
        score: parseFloat(String(snap.score)),
      });
    }

    res.json({ history });
  } catch (err) {
    console.error('Score history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
