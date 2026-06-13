import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  capperProfiles, capperSubscriptions, tailEvents,
  users, gammblerScores, betSlips, bets,
} from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { z } from 'zod';
import {
  CAPPER_MIN_SCORE,
  CAPPER_MIN_BETS,
  CAPPER_PLATFORM_RAKE,
  CAPPER_DEFAULT_PRICE_CENTS,
} from '@gammbler/shared';

const router = Router();

const updateCapperSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(2000).optional(),
  price_cents: z.number().int().min(199).max(9999).optional(),
  banner_url: z.string().url().optional().nullable(),
  profile_photo_url: z.string().url().optional().nullable(),
  favorite_sports: z.array(z.string()).max(6).optional(),
  favorite_teams: z.array(z.string()).max(10).optional(),
  betting_style: z.string().max(100).optional().nullable(),
  social_links: z.object({
    twitter: z.string().max(200).optional(),
    instagram: z.string().max(200).optional(),
    youtube: z.string().max(200).optional(),
    tiktok: z.string().max(200).optional(),
    website: z.string().max(200).optional(),
  }).optional(),
});

// POST /cappers/apply — apply to become a verified capper
router.post('/apply', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    // Check if already a capper
    const [existing] = await db
      .select()
      .from(capperProfiles)
      .where(eq(capperProfiles.user_id, userId))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: 'Already a verified capper', capper: existing });
      return;
    }

    // Get user's overall score and bet count
    const [score] = await db
      .select()
      .from(gammblerScores)
      .where(
        and(
          eq(gammblerScores.user_id, userId),
          eq(gammblerScores.sport, 'overall' as any)
        )
      )
      .limit(1);

    if (!score || !score.is_unlocked) {
      res.status(400).json({ error: 'Score not yet unlocked. Need at least 10 settled bets.' });
      return;
    }

    const scoreVal = parseFloat(String(score.score));
    const betCount = score.settled_bet_count;

    if (scoreVal < CAPPER_MIN_SCORE) {
      res.status(400).json({
        error: `Score too low. Need ${CAPPER_MIN_SCORE}+ to become a Verified Capper. Current: ${scoreVal.toFixed(1)}`,
        required_score: CAPPER_MIN_SCORE,
        current_score: scoreVal,
      });
      return;
    }

    if (betCount < CAPPER_MIN_BETS) {
      res.status(400).json({
        error: `Need ${CAPPER_MIN_BETS}+ settled bets. Current: ${betCount}`,
        required_bets: CAPPER_MIN_BETS,
        current_bets: betCount,
      });
      return;
    }

    const [user] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const [capper] = await db.insert(capperProfiles).values({
      user_id: userId,
      display_name: user?.username || 'Verified Capper',
      price_cents: CAPPER_DEFAULT_PRICE_CENTS,
      verified_score: String(scoreVal),
    }).returning();

    res.status(201).json({ capper });
  } catch (err) {
    console.error('Apply capper error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /cappers — browse verified cappers
router.get('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const sort = req.query.sort as string || 'score';

    const orderBy = sort === 'subscribers'
      ? desc(capperProfiles.total_subscribers)
      : sort === 'tails'
        ? desc(capperProfiles.total_tails)
        : desc(capperProfiles.verified_score);

    const results = await db
      .select({
        capper: capperProfiles,
        username: users.username,
        avatar_url: users.avatar_url,
      })
      .from(capperProfiles)
      .innerJoin(users, eq(capperProfiles.user_id, users.id))
      .where(eq(capperProfiles.status, 'active'))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get current scores for each capper
    const cappersWithScores = await Promise.all(
      results.map(async (row) => {
        const [score] = await db
          .select({ score: gammblerScores.score })
          .from(gammblerScores)
          .where(
            and(
              eq(gammblerScores.user_id, row.capper.user_id),
              eq(gammblerScores.sport, 'overall' as any)
            )
          )
          .limit(1);

        let isSubscribed = false;
        if (req.user) {
          const [sub] = await db
            .select()
            .from(capperSubscriptions)
            .where(
              and(
                eq(capperSubscriptions.capper_user_id, row.capper.user_id),
                eq(capperSubscriptions.subscriber_user_id, req.user.userId),
                eq(capperSubscriptions.status, 'active')
              )
            )
            .limit(1);
          isSubscribed = !!sub;
        }

        return {
          ...row.capper,
          user: {
            username: row.username,
            avatar_url: row.avatar_url,
          },
          current_score: score?.score || row.capper.verified_score,
          is_subscribed: isSubscribed,
        };
      })
    );

    res.json({ cappers: cappersWithScores });
  } catch (err) {
    console.error('Get cappers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /cappers/:userId — get capper profile
router.get('/:userId', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [result] = await db
      .select({
        capper: capperProfiles,
        username: users.username,
        avatar_url: users.avatar_url,
      })
      .from(capperProfiles)
      .innerJoin(users, eq(capperProfiles.user_id, users.id))
      .where(eq(capperProfiles.user_id, req.params.userId))
      .limit(1);

    if (!result) {
      res.status(404).json({ error: 'Capper not found' });
      return;
    }

    // Get current score
    const [score] = await db
      .select()
      .from(gammblerScores)
      .where(
        and(
          eq(gammblerScores.user_id, req.params.userId),
          eq(gammblerScores.sport, 'overall' as any)
        )
      )
      .limit(1);

    // Get recent slips
    const recentSlips = await db
      .select()
      .from(betSlips)
      .where(
        and(
          eq(betSlips.user_id, req.params.userId),
          eq(betSlips.is_public, true)
        )
      )
      .orderBy(desc(betSlips.shared_at))
      .limit(10);

    // Check subscription
    let isSubscribed = false;
    if (req.user) {
      const [sub] = await db
        .select()
        .from(capperSubscriptions)
        .where(
          and(
            eq(capperSubscriptions.capper_user_id, req.params.userId),
            eq(capperSubscriptions.subscriber_user_id, req.user.userId),
            eq(capperSubscriptions.status, 'active')
          )
        )
        .limit(1);
      isSubscribed = !!sub;
    }

    // Calculate recent win rate from slips
    const settledSlips = recentSlips.filter(s => s.status !== 'live');
    const winCount = settledSlips.filter(s => s.status === 'won').length;
    const recentWinRate = settledSlips.length > 0 ? (winCount / settledSlips.length) * 100 : 0;

    res.json({
      capper: {
        ...result.capper,
        user: {
          username: result.username,
          avatar_url: result.avatar_url,
        },
        current_score: score?.score || result.capper.verified_score,
        recent_slips: recentSlips,
        recent_win_rate: Math.round(recentWinRate * 10) / 10,
        is_subscribed: isSubscribed,
        is_self: req.user?.userId === result.capper.user_id,
      },
    });
  } catch (err) {
    console.error('Get capper error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /cappers/me — update own capper profile
router.patch('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = updateCapperSchema.parse(req.body);

    const [capper] = await db
      .select()
      .from(capperProfiles)
      .where(eq(capperProfiles.user_id, req.user!.userId))
      .limit(1);

    if (!capper) {
      res.status(404).json({ error: 'Not a verified capper' });
      return;
    }

    const updateData: Record<string, any> = {};
    if (body.display_name) updateData.display_name = body.display_name;
    if (body.bio !== undefined) updateData.bio = body.bio;
    if (body.price_cents !== undefined) updateData.price_cents = body.price_cents;
    if (body.banner_url !== undefined) updateData.banner_url = body.banner_url;
    if (body.profile_photo_url !== undefined) updateData.profile_photo_url = body.profile_photo_url;
    if (body.favorite_sports !== undefined) updateData.favorite_sports = body.favorite_sports;
    if (body.favorite_teams !== undefined) updateData.favorite_teams = body.favorite_teams;
    if (body.betting_style !== undefined) updateData.betting_style = body.betting_style;
    if (body.social_links !== undefined) updateData.social_links = body.social_links;

    const [updated] = await db.update(capperProfiles)
      .set(updateData)
      .where(eq(capperProfiles.user_id, req.user!.userId))
      .returning();

    res.json({ capper: updated });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    console.error('Update capper error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /cappers/:userId/subscribe — subscribe to a capper
router.post('/:userId/subscribe', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const capperUserId = req.params.userId;
    const subscriberUserId = req.user!.userId;

    if (capperUserId === subscriberUserId) {
      res.status(400).json({ error: 'Cannot subscribe to yourself' });
      return;
    }

    // Check capper exists
    const [capper] = await db
      .select()
      .from(capperProfiles)
      .where(
        and(
          eq(capperProfiles.user_id, capperUserId),
          eq(capperProfiles.status, 'active')
        )
      )
      .limit(1);

    if (!capper) {
      res.status(404).json({ error: 'Capper not found' });
      return;
    }

    // Check existing sub
    const [existing] = await db
      .select()
      .from(capperSubscriptions)
      .where(
        and(
          eq(capperSubscriptions.capper_user_id, capperUserId),
          eq(capperSubscriptions.subscriber_user_id, subscriberUserId)
        )
      )
      .limit(1);

    if (existing && existing.status === 'active') {
      res.status(409).json({ error: 'Already subscribed' });
      return;
    }

    // For now, create subscription directly (Stripe integration handled separately)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    if (existing) {
      const [updated] = await db.update(capperSubscriptions)
        .set({ status: 'active', expires_at: expiresAt })
        .where(eq(capperSubscriptions.id, existing.id))
        .returning();

      await db.update(capperProfiles)
        .set({ total_subscribers: sql`${capperProfiles.total_subscribers} + 1` })
        .where(eq(capperProfiles.user_id, capperUserId));

      res.json({ subscription: updated });
      return;
    }

    const [subscription] = await db.insert(capperSubscriptions).values({
      capper_user_id: capperUserId,
      subscriber_user_id: subscriberUserId,
      price_cents: capper.price_cents,
      expires_at: expiresAt,
    }).returning();

    await db.update(capperProfiles)
      .set({ total_subscribers: sql`${capperProfiles.total_subscribers} + 1` })
      .where(eq(capperProfiles.user_id, capperUserId));

    res.status(201).json({ subscription });
  } catch (err) {
    console.error('Subscribe to capper error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /cappers/:userId/subscribe — unsubscribe from a capper
router.delete('/:userId/subscribe', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const [sub] = await db
      .select()
      .from(capperSubscriptions)
      .where(
        and(
          eq(capperSubscriptions.capper_user_id, req.params.userId),
          eq(capperSubscriptions.subscriber_user_id, req.user!.userId),
          eq(capperSubscriptions.status, 'active')
        )
      )
      .limit(1);

    if (!sub) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }

    await db.update(capperSubscriptions)
      .set({ status: 'cancelled' })
      .where(eq(capperSubscriptions.id, sub.id));

    await db.update(capperProfiles)
      .set({ total_subscribers: sql`GREATEST(${capperProfiles.total_subscribers} - 1, 0)` })
      .where(eq(capperProfiles.user_id, req.params.userId));

    res.json({ success: true });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /cappers/tail/:slipId — tail a capper's bet slip
router.post('/tail/:slipId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const tailerUserId = req.user!.userId;

    // Get the slip
    const [slip] = await db
      .select()
      .from(betSlips)
      .where(eq(betSlips.id, req.params.slipId))
      .limit(1);

    if (!slip) {
      res.status(404).json({ error: 'Slip not found' });
      return;
    }

    if (slip.status !== 'live') {
      res.status(400).json({ error: 'Can only tail live slips' });
      return;
    }

    // Check slip owner is a verified capper
    const [capper] = await db
      .select()
      .from(capperProfiles)
      .where(
        and(
          eq(capperProfiles.user_id, slip.user_id),
          eq(capperProfiles.status, 'active')
        )
      )
      .limit(1);

    if (!capper) {
      res.status(400).json({ error: 'Slip owner is not a verified capper' });
      return;
    }

    // Check subscriber status
    const [sub] = await db
      .select()
      .from(capperSubscriptions)
      .where(
        and(
          eq(capperSubscriptions.capper_user_id, slip.user_id),
          eq(capperSubscriptions.subscriber_user_id, tailerUserId),
          eq(capperSubscriptions.status, 'active')
        )
      )
      .limit(1);

    if (!sub) {
      res.status(403).json({ error: 'Must be subscribed to tail this capper', subscribe: true });
      return;
    }

    // Record tail event
    const [tailEvent] = await db.insert(tailEvents).values({
      slip_id: req.params.slipId,
      capper_user_id: slip.user_id,
      tailer_user_id: tailerUserId,
    }).returning();

    // Update capper tail count
    await db.update(capperProfiles)
      .set({ total_tails: sql`${capperProfiles.total_tails} + 1` })
      .where(eq(capperProfiles.user_id, slip.user_id));

    res.status(201).json({
      tail: tailEvent,
      slip_details: {
        selection: slip.selection,
        odds: slip.odds,
        sport: slip.sport,
        bet_type: slip.bet_type,
        platform: slip.platform,
        event_name: slip.event_name,
      },
    });
  } catch (err) {
    console.error('Tail slip error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /cappers/me/subscribers — get my subscribers (capper view)
router.get('/me/subscribers', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const [capper] = await db
      .select()
      .from(capperProfiles)
      .where(eq(capperProfiles.user_id, req.user!.userId))
      .limit(1);

    if (!capper) {
      res.status(404).json({ error: 'Not a verified capper' });
      return;
    }

    const subs = await db
      .select({
        subscription: capperSubscriptions,
        username: users.username,
        avatar_url: users.avatar_url,
      })
      .from(capperSubscriptions)
      .innerJoin(users, eq(capperSubscriptions.subscriber_user_id, users.id))
      .where(
        and(
          eq(capperSubscriptions.capper_user_id, req.user!.userId),
          eq(capperSubscriptions.status, 'active')
        )
      )
      .orderBy(desc(capperSubscriptions.created_at));

    res.json({
      subscribers: subs.map(s => ({
        ...s.subscription,
        user: { username: s.username, avatar_url: s.avatar_url },
      })),
      total: subs.length,
      monthly_revenue_cents: subs.reduce((sum, s) => sum + s.subscription.price_cents, 0),
      platform_rake: CAPPER_PLATFORM_RAKE,
    });
  } catch (err) {
    console.error('Get subscribers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /cappers/me/earnings — get earnings summary
router.get('/me/earnings', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const [capper] = await db
      .select()
      .from(capperProfiles)
      .where(eq(capperProfiles.user_id, req.user!.userId))
      .limit(1);

    if (!capper) {
      res.status(404).json({ error: 'Not a verified capper' });
      return;
    }

    const totalGross = capper.total_earnings_cents;
    const platformTake = Math.floor(totalGross * CAPPER_PLATFORM_RAKE);
    const netEarnings = totalGross - platformTake;

    res.json({
      ...capper,
      total_gross_cents: totalGross,
      platform_rake_cents: platformTake,
      net_earnings_cents: netEarnings,
      total_subscribers: capper.total_subscribers,
      total_tails: capper.total_tails,
      platform_rake_pct: CAPPER_PLATFORM_RAKE * 100,
    });
  } catch (err) {
    console.error('Get earnings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
