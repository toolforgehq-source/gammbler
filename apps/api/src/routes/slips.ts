import { Router, Request, Response } from 'express';
import { db } from '../db';
import { betSlips, betSlipReactions, users, gammblerScores, bets, capperProfiles, capperSubscriptions } from '../db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { z } from 'zod';
import sharp from 'sharp';

const router = Router();

const createSlipSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  sport: z.string(),
  bet_type: z.string(),
  selection: z.string().min(1),
  odds: z.number(),
  stake: z.number().positive(),
  platform: z.string(),
  event_name: z.string().max(200).optional(),
  parlay_legs: z.number().int().positive().optional(),
  bet_id: z.string().uuid().optional(),
  is_public: z.boolean().optional(),
});

const settleSlipSchema = z.object({
  result: z.enum(['won', 'lost', 'pushed', 'void']),
  profit_loss: z.number().optional(),
});

const reactionSchema = z.object({
  reaction: z.enum(['fire', 'skull', 'money', 'clown', 'goat']),
});

// POST /slips — create and share a bet slip
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = createSlipSchema.parse(req.body);
    const userId = req.user!.userId;

    const [slip] = await db.insert(betSlips).values({
      user_id: userId,
      bet_id: body.bet_id || null,
      title: body.title,
      description: body.description || null,
      sport: body.sport as any,
      bet_type: body.bet_type as any,
      selection: body.selection,
      odds: String(body.odds),
      stake: String(body.stake),
      platform: body.platform as any,
      event_name: body.event_name || null,
      parlay_legs: body.parlay_legs || null,
      is_public: body.is_public ?? true,
    }).returning();

    res.status(201).json({ slip });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    console.error('Create slip error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /slips — get feed of public slips
router.get('/', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const sport = req.query.sport as string;
    const status = req.query.status as string;
    const userId = req.query.user_id as string;

    const conditions = [eq(betSlips.is_public, true)];
    if (sport) conditions.push(eq(betSlips.sport, sport as any));
    if (status) conditions.push(eq(betSlips.status, status as any));
    if (userId) conditions.push(eq(betSlips.user_id, userId));

    const results = await db
      .select({
        slip: betSlips,
        username: users.username,
        avatar_url: users.avatar_url,
      })
      .from(betSlips)
      .innerJoin(users, eq(betSlips.user_id, users.id))
      .where(and(...conditions))
      .orderBy(desc(betSlips.shared_at))
      .limit(limit)
      .offset(offset);

    const slipsWithReactions = await Promise.all(
      results.map(async (row) => {
        const reactions = await db
          .select({
            reaction: betSlipReactions.reaction,
            count: sql<number>`count(*)`,
          })
          .from(betSlipReactions)
          .where(eq(betSlipReactions.slip_id, row.slip.id))
          .groupBy(betSlipReactions.reaction);

        let userReaction: string | null = null;
        if (req.user) {
          const [ur] = await db
            .select({ reaction: betSlipReactions.reaction })
            .from(betSlipReactions)
            .where(
              and(
                eq(betSlipReactions.slip_id, row.slip.id),
                eq(betSlipReactions.user_id, req.user.userId)
              )
            )
            .limit(1);
          userReaction = ur?.reaction || null;
        }

        // Check if slip owner is a capper and get their tier
        const [capper] = await db
          .select({ id: capperProfiles.id, tier: capperProfiles.tier })
          .from(capperProfiles)
          .where(
            and(
              eq(capperProfiles.user_id, row.slip.user_id),
              eq(capperProfiles.status, 'active')
            )
          )
          .limit(1);

        return {
          ...row.slip,
          user: {
            username: row.username,
            avatar_url: row.avatar_url,
          },
          reactions: reactions.reduce((acc, r) => ({ ...acc, [r.reaction]: Number(r.count) }), {} as Record<string, number>),
          user_reaction: userReaction,
          is_verified_capper: !!capper,
          capper_tier: capper?.tier || null,
        };
      })
    );

    res.json({ slips: slipsWithReactions });
  } catch (err) {
    console.error('Get slips error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /slips/mine — get current user's slips
router.get('/mine', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const results = await db
      .select()
      .from(betSlips)
      .where(eq(betSlips.user_id, req.user!.userId))
      .orderBy(desc(betSlips.shared_at))
      .limit(limit)
      .offset(offset);

    res.json({ slips: results });
  } catch (err) {
    console.error('Get my slips error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /slips/:id — get single slip with details
router.get('/:id', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [result] = await db
      .select({
        slip: betSlips,
        username: users.username,
        avatar_url: users.avatar_url,
      })
      .from(betSlips)
      .innerJoin(users, eq(betSlips.user_id, users.id))
      .where(eq(betSlips.id, req.params.id))
      .limit(1);

    if (!result) {
      res.status(404).json({ error: 'Slip not found' });
      return;
    }

    if (!result.slip.is_public && result.slip.user_id !== req.user?.userId) {
      res.status(404).json({ error: 'Slip not found' });
      return;
    }

    // Increment views
    await db.update(betSlips)
      .set({ views_count: sql`${betSlips.views_count} + 1` })
      .where(eq(betSlips.id, req.params.id));

    // Get reactions
    const reactions = await db
      .select({
        reaction: betSlipReactions.reaction,
        count: sql<number>`count(*)`,
      })
      .from(betSlipReactions)
      .where(eq(betSlipReactions.slip_id, req.params.id))
      .groupBy(betSlipReactions.reaction);

    let userReaction: string | null = null;
    if (req.user) {
      const [ur] = await db
        .select({ reaction: betSlipReactions.reaction })
        .from(betSlipReactions)
        .where(
          and(
            eq(betSlipReactions.slip_id, req.params.id),
            eq(betSlipReactions.user_id, req.user.userId)
          )
        )
        .limit(1);
      userReaction = ur?.reaction || null;
    }

    // Get user score
    const [score] = await db
      .select({ score: gammblerScores.score })
      .from(gammblerScores)
      .where(
        and(
          eq(gammblerScores.user_id, result.slip.user_id),
          eq(gammblerScores.sport, 'overall' as any)
        )
      )
      .limit(1);

    res.json({
      slip: {
        ...result.slip,
        user: {
          username: result.username,
          avatar_url: result.avatar_url,
          score: score?.score || null,
        },
        reactions: reactions.reduce((acc, r) => ({ ...acc, [r.reaction]: Number(r.count) }), {} as Record<string, number>),
        user_reaction: userReaction,
      },
    });
  } catch (err) {
    console.error('Get slip error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /slips/:id/settle — settle a slip (owner only)
router.patch('/:id/settle', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = settleSlipSchema.parse(req.body);

    const [slip] = await db
      .select()
      .from(betSlips)
      .where(
        and(
          eq(betSlips.id, req.params.id),
          eq(betSlips.user_id, req.user!.userId)
        )
      )
      .limit(1);

    if (!slip) {
      res.status(404).json({ error: 'Slip not found' });
      return;
    }

    if (slip.status !== 'live') {
      res.status(400).json({ error: 'Slip already settled' });
      return;
    }

    const profitLoss = body.profit_loss !== undefined
      ? String(body.profit_loss)
      : body.result === 'won'
        ? String(parseFloat(String(slip.stake)) * (parseFloat(String(slip.odds)) > 0
          ? parseFloat(String(slip.odds)) / 100
          : 100 / Math.abs(parseFloat(String(slip.odds)))))
        : body.result === 'lost'
          ? String(-parseFloat(String(slip.stake)))
          : '0';

    const [updated] = await db.update(betSlips)
      .set({
        status: body.result as any,
        profit_loss: profitLoss,
        settled_at: new Date(),
      })
      .where(eq(betSlips.id, req.params.id))
      .returning();

    res.json({ slip: updated });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    console.error('Settle slip error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /slips/:id/react — add/update reaction
router.post('/:id/react', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = reactionSchema.parse(req.body);
    const userId = req.user!.userId;

    const [existing] = await db
      .select()
      .from(betSlipReactions)
      .where(
        and(
          eq(betSlipReactions.slip_id, req.params.id),
          eq(betSlipReactions.user_id, userId)
        )
      )
      .limit(1);

    if (existing) {
      if (existing.reaction === body.reaction) {
        await db.delete(betSlipReactions).where(eq(betSlipReactions.id, existing.id));
        res.json({ removed: true });
        return;
      }
      await db.update(betSlipReactions)
        .set({ reaction: body.reaction as any })
        .where(eq(betSlipReactions.id, existing.id));
      res.json({ updated: true, reaction: body.reaction });
      return;
    }

    await db.insert(betSlipReactions).values({
      slip_id: req.params.id,
      user_id: userId,
      reaction: body.reaction as any,
    });

    res.json({ added: true, reaction: body.reaction });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid input', details: err.errors });
      return;
    }
    console.error('React to slip error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /slips/:id/share — increment share count
router.post('/:id/share', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.update(betSlips)
      .set({ shares_count: sql`${betSlips.shares_count} + 1` })
      .where(eq(betSlips.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    console.error('Share slip error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /slips/:id/card — generate shareable card image
router.post('/:id/card', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [result] = await db
      .select({
        slip: betSlips,
        username: users.username,
      })
      .from(betSlips)
      .innerJoin(users, eq(betSlips.user_id, users.id))
      .where(eq(betSlips.id, req.params.id))
      .limit(1);

    if (!result) {
      res.status(404).json({ error: 'Slip not found' });
      return;
    }

    const slip = result.slip;
    const oddsVal = parseFloat(String(slip.odds));
    const stakeVal = parseFloat(String(slip.stake));
    const oddsStr = oddsVal > 0 ? `+${oddsVal}` : String(oddsVal);
    const statusColor = slip.status === 'won' ? '#66bb6a'
      : slip.status === 'lost' ? '#ef5350'
      : slip.status === 'pushed' ? '#FFD700'
      : '#4caf50';
    const statusText = slip.status.toUpperCase();
    const pl = slip.profit_loss ? parseFloat(String(slip.profit_loss)) : null;
    const plStr = pl !== null ? (pl >= 0 ? `+$${pl.toFixed(2)}` : `-$${Math.abs(pl).toFixed(2)}`) : '';

    const svgContent = `
      <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0f2912"/>
            <stop offset="100%" stop-color="#163a1a"/>
          </linearGradient>
        </defs>
        <rect width="800" height="500" fill="url(#bg)" rx="20"/>
        <rect x="20" y="20" width="760" height="460" fill="none" stroke="#4caf5040" stroke-width="1" rx="15"/>

        <!-- Header -->
        <text x="50" y="65" fill="#4caf50" font-family="Arial, sans-serif" font-size="24" font-weight="bold"
              letter-spacing="4">GAMMBLER</text>
        <text x="750" y="65" fill="${statusColor}" font-family="Arial, sans-serif" font-size="18" text-anchor="end"
              font-weight="bold" letter-spacing="2">${statusText}</text>

        <!-- User -->
        <text x="50" y="115" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="16">@${result.username}</text>
        <text x="750" y="115" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="14" text-anchor="end">
          ${String(slip.sport).toUpperCase()} • ${String(slip.platform).toUpperCase()}</text>

        <!-- Title -->
        <text x="50" y="175" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="28" font-weight="bold">
          ${slip.title.substring(0, 40)}</text>

        <!-- Selection -->
        <text x="50" y="220" fill="#e0e0e0" font-family="Arial, sans-serif" font-size="20">
          ${slip.selection.substring(0, 50)}</text>

        ${slip.event_name ? `<text x="50" y="255" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="15">${slip.event_name.substring(0, 60)}</text>` : ''}

        <!-- Stats -->
        <text x="50" y="320" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">ODDS</text>
        <text x="50" y="355" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="36" font-weight="bold">${oddsStr}</text>

        <text x="250" y="320" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">STAKE</text>
        <text x="250" y="355" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="36" font-weight="bold">$${stakeVal.toFixed(0)}</text>

        ${plStr ? `
          <text x="450" y="320" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">P/L</text>
          <text x="450" y="355" fill="${pl !== null && pl >= 0 ? '#66bb6a' : '#ef5350'}" font-family="Arial, sans-serif" font-size="36" font-weight="bold">${plStr}</text>
        ` : ''}

        <!-- Bet Type -->
        <rect x="50" y="385" width="120" height="30" rx="15" fill="#4caf5020" stroke="#4caf5040" stroke-width="1"/>
        <text x="110" y="405" fill="#4caf50" font-family="Arial, sans-serif" font-size="12" text-anchor="middle"
              letter-spacing="1">${String(slip.bet_type).toUpperCase()}</text>

        ${slip.parlay_legs ? `
          <rect x="185" y="385" width="100" height="30" rx="15" fill="#FFD70020" stroke="#FFD70040" stroke-width="1"/>
          <text x="235" y="405" fill="#FFD700" font-family="Arial, sans-serif" font-size="12" text-anchor="middle"
                letter-spacing="1">${slip.parlay_legs}-LEG PARLAY</text>
        ` : ''}

        <!-- Footer -->
        <text x="750" y="465" fill="#4caf5060" font-family="Arial, sans-serif" font-size="11" text-anchor="end"
              letter-spacing="1">gammbler.com</text>

        <!-- Views/Shares -->
        <text x="50" y="465" fill="#6b6b6b" font-family="Arial, sans-serif" font-size="11">
          ${slip.views_count} views • ${slip.shares_count} shares</text>
      </svg>`;

    const buffer = await sharp(Buffer.from(svgContent)).png().toBuffer();

    // Increment share count
    await db.update(betSlips)
      .set({ shares_count: sql`${betSlips.shares_count} + 1` })
      .where(eq(betSlips.id, req.params.id));

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=60');
    res.send(buffer);
  } catch (err) {
    console.error('Generate slip card error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /slips/:id — delete own slip
router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const [slip] = await db
      .select()
      .from(betSlips)
      .where(
        and(
          eq(betSlips.id, req.params.id),
          eq(betSlips.user_id, req.user!.userId)
        )
      )
      .limit(1);

    if (!slip) {
      res.status(404).json({ error: 'Slip not found' });
      return;
    }

    await db.delete(betSlips).where(eq(betSlips.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error('Delete slip error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
