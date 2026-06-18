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
  CAPPER_VERIFIED_MIN_SCORE,
  CAPPER_VERIFIED_MIN_BETS,
  CAPPER_ELITE_MIN_SCORE,
  CAPPER_ELITE_MIN_BETS,
  CAPPER_DEFAULT_PRICE_CENTS,
  CREATOR_PLAN_TYPES,
  CapperTier,
} from '@gammbler/shared';
import { checkAndAwardCreatorBadges } from '../services/creator-badges';

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

function computeCapperTier(score: number | null, betCount: number): CapperTier {
  if (score !== null && score >= CAPPER_ELITE_MIN_SCORE && betCount >= CAPPER_ELITE_MIN_BETS) {
    return 'elite';
  }
  if (score !== null && score >= CAPPER_VERIFIED_MIN_SCORE && betCount >= CAPPER_VERIFIED_MIN_BETS) {
    return 'verified';
  }
  return 'capper';
}

// POST /cappers/apply — become a capper (no score requirement)
router.post('/apply', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const [existing] = await db
      .select()
      .from(capperProfiles)
      .where(eq(capperProfiles.user_id, userId))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: 'Already a capper', capper: existing });
      return;
    }

    const [user] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Check score to determine initial tier
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

    const scoreVal = score && score.is_unlocked ? parseFloat(String(score.score)) : null;
    const betCount = score?.settled_bet_count || 0;
    const tier = computeCapperTier(scoreVal, betCount);

    const [capper] = await db.insert(capperProfiles).values({
      user_id: userId,
      display_name: user?.username || 'Capper',
      price_cents: CAPPER_DEFAULT_PRICE_CENTS,
      tier: tier as any,
      creator_plan_type: 'standard',
      revenue_share_pct: String(CREATOR_PLAN_TYPES.standard.fee_pct * 100 === 20 ? 80 : (1 - CREATOR_PLAN_TYPES.standard.fee_pct) * 100),
      verified_score: String(scoreVal || 0),
      verified_at: tier !== 'capper' ? new Date() : null,
    }).returning();

    res.status(201).json({ capper });
  } catch (err) {
    console.error('Apply capper error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /cappers/refresh-tier — recalculate capper tier based on current score
router.post('/refresh-tier', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const [capper] = await db
      .select()
      .from(capperProfiles)
      .where(eq(capperProfiles.user_id, userId))
      .limit(1);

    if (!capper) {
      res.status(404).json({ error: 'Not a capper' });
      return;
    }

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

    const scoreVal = score && score.is_unlocked ? parseFloat(String(score.score)) : null;
    const betCount = score?.settled_bet_count || 0;
    const newTier = computeCapperTier(scoreVal, betCount);

    const updateData: Record<string, unknown> = { tier: newTier };
    if (newTier !== 'capper' && !capper.verified_at) {
      updateData.verified_at = new Date();
      updateData.verified_score = String(scoreVal || 0);
    }

    const [updated] = await db.update(capperProfiles)
      .set(updateData)
      .where(eq(capperProfiles.user_id, userId))
      .returning();

    res.json({ capper: updated, previous_tier: capper.tier, new_tier: newTier });
  } catch (err) {
    console.error('Refresh tier error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /cappers — browse cappers
router.get('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const sort = req.query.sort as string || 'score';
    const tierFilter = req.query.tier as string | undefined;

    const orderBy = sort === 'subscribers'
      ? desc(capperProfiles.total_subscribers)
      : sort === 'tails'
        ? desc(capperProfiles.total_tails)
        : desc(capperProfiles.verified_score);

    let conditions = eq(capperProfiles.status, 'active');
    if (tierFilter && ['verified', 'elite'].includes(tierFilter)) {
      conditions = and(conditions, eq(capperProfiles.tier, tierFilter as any))!;
    }

    const results = await db
      .select({
        capper: capperProfiles,
        username: users.username,
        avatar_url: users.avatar_url,
      })
      .from(capperProfiles)
      .innerJoin(users, eq(capperProfiles.user_id, users.id))
      .where(conditions)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

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
      res.status(404).json({ error: 'Not a capper' });
      return;
    }

    const updateData: Record<string, unknown> = {};
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
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: (err as { errors?: unknown }).errors });
      return;
    }
    console.error('Update capper error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /cappers/:userId/subscribe — follow a capper (free — paid subscriptions coming soon)
router.post('/:userId/subscribe', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const capperUserId = req.params.userId;
    const subscriberUserId = req.user!.userId;

    if (capperUserId === subscriberUserId) {
      res.status(400).json({ error: 'Cannot follow yourself' });
      return;
    }

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
      res.status(409).json({ error: 'Already following' });
      return;
    }

    // Free follow — no payment required. Paid subscriptions via Stripe coming soon.
    if (existing) {
      const [updated] = await db.update(capperSubscriptions)
        .set({ status: 'active', expires_at: null })
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
      price_cents: 0,
      expires_at: null,
    }).returning();

    await db.update(capperProfiles)
      .set({ total_subscribers: sql`${capperProfiles.total_subscribers} + 1` })
      .where(eq(capperProfiles.user_id, capperUserId));

    checkAndAwardCreatorBadges(capperUserId).catch(() => {});

    res.status(201).json({ subscription });
  } catch (err) {
    console.error('Follow capper error:', err);
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
      res.status(400).json({ error: 'Slip owner is not a capper' });
      return;
    }

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

    const [tailEvent] = await db.insert(tailEvents).values({
      slip_id: req.params.slipId,
      capper_user_id: slip.user_id,
      tailer_user_id: tailerUserId,
    }).returning();

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
      res.status(404).json({ error: 'Not a capper' });
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

    const creatorKeepsPct = parseFloat(String(capper.revenue_share_pct));
    const platformFeePct = 100 - creatorKeepsPct;

    res.json({
      subscribers: subs.map(s => ({
        ...s.subscription,
        user: { username: s.username, avatar_url: s.avatar_url },
      })),
      total: subs.length,
      monthly_revenue_cents: subs.reduce((sum, s) => sum + s.subscription.price_cents, 0),
      platform_rake: platformFeePct / 100,
      creator_keeps_pct: creatorKeepsPct,
      creator_plan_type: capper.creator_plan_type,
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
      res.status(404).json({ error: 'Not a capper' });
      return;
    }

    const creatorKeepsPct = parseFloat(String(capper.revenue_share_pct));
    const platformFeePct = 100 - creatorKeepsPct;
    const totalGross = capper.total_earnings_cents;
    const platformTake = Math.floor(totalGross * (platformFeePct / 100));
    const netEarnings = totalGross - platformTake;

    res.json({
      ...capper,
      total_gross_cents: totalGross,
      platform_rake_cents: platformTake,
      net_earnings_cents: netEarnings,
      total_subscribers: capper.total_subscribers,
      total_tails: capper.total_tails,
      platform_fee_pct: platformFeePct,
      creator_keeps_pct: creatorKeepsPct,
      creator_plan_type: capper.creator_plan_type,
      tier: capper.tier,
    });
  } catch (err) {
    console.error('Get earnings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
