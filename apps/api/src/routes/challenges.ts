import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { challenges, users, gammblerScores, badges } from '../db/schema';
import { eq, and, or, desc, sql, inArray } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { createFeedEvent } from '../services/feed';
import { sendChallengeReceivedEmail, sendChallengeResultEmail } from '../services/email';
import { notifyChallengeReceived, notifyChallengeAccepted, notifyChallengeSettled } from '../services/notifications';
import { H2H_CHALLENGE_EXPIRY_HOURS, H2H_MAX_ACTIVE_CHALLENGES } from '@gammbler/shared';

const router = Router();

const createChallengeSchema = z.object({
  challengee_username: z.string().min(1),
  sport: z.enum(['nfl', 'nba', 'mlb', 'nhl', 'cfb', 'cbb', 'soccer', 'prizepicks', 'dfs']),
  event_name: z.string().min(1).max(200),
  event_start_time: z.string().datetime().optional(),
  challenger_pick: z.string().min(1).max(200),
  message: z.string().max(500).optional(),
  stake_display: z.string().max(100).optional(),
  // Verified H2H fields
  is_verified: z.boolean().optional(),
  odds_api_event_id: z.string().optional(),
  market: z.enum(['h2h', 'spreads', 'totals']).optional(),
  challenger_line: z.number().optional(),
  challenger_odds: z.number().int().optional(),
  challengee_odds: z.number().int().optional(),
  home_team: z.string().optional(),
  away_team: z.string().optional(),
});

const settleChallengeSchema = z.object({
  winner_id: z.string().uuid(),
});

// GET /challenges — list challenges for the current user
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const status = req.query.status as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    let conditions = or(
      eq(challenges.challenger_id, userId),
      eq(challenges.challengee_id, userId)
    )!;

    if (status) {
      const validStatuses = ['pending', 'accepted', 'declined', 'settled', 'cancelled', 'expired', 'auto_settled'];
      if (validStatuses.includes(status)) {
        // "settled" filter should include both manual and auto-settled
        if (status === 'settled') {
          conditions = and(
            conditions,
            sql`${challenges.status} IN ('settled', 'auto_settled')`
          )!;
        } else {
          conditions = and(
            conditions,
            eq(challenges.status, status as any)
          )!;
        }
      }
    }

    const rows = await db
      .select()
      .from(challenges)
      .where(conditions)
      .orderBy(desc(challenges.created_at))
      .limit(limit)
      .offset(offset);

    // Get user info for all participants
    const userIds = new Set<string>();
    rows.forEach((c) => {
      userIds.add(c.challenger_id);
      userIds.add(c.challengee_id);
      if (c.winner_id) userIds.add(c.winner_id);
    });

    const userMap = new Map<string, { username: string; avatar_url: string | null }>();
    if (userIds.size > 0) {
      const userRows = await db
        .select({ id: users.id, username: users.username, avatar_url: users.avatar_url })
        .from(users)
        .where(inArray(users.id, Array.from(userIds)));
      userRows.forEach((u) => userMap.set(u.id, { username: u.username, avatar_url: u.avatar_url }));
    }

    const enriched = rows.map((c) => ({
      ...c,
      challenger: userMap.get(c.challenger_id) || null,
      challengee: userMap.get(c.challengee_id) || null,
      winner: c.winner_id ? userMap.get(c.winner_id) || null : null,
      is_challenger: c.challenger_id === userId,
    }));

    res.json({ challenges: enriched });
  } catch (err) {
    console.error('List challenges error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /challenges/stats — H2H record for current user
router.get('/stats', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const settledCondition = sql`${challenges.status} IN ('settled', 'auto_settled')`;

    const [winsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(challenges)
      .where(
        and(
          settledCondition,
          eq(challenges.winner_id, userId)
        )
      );

    const [lossesResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(challenges)
      .where(
        and(
          settledCondition,
          or(
            eq(challenges.challenger_id, userId),
            eq(challenges.challengee_id, userId)
          ),
          sql`${challenges.winner_id} IS NOT NULL AND ${challenges.winner_id} != ${userId}`
        )
      );

    const [drawsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(challenges)
      .where(
        and(
          settledCondition,
          or(
            eq(challenges.challenger_id, userId),
            eq(challenges.challengee_id, userId)
          ),
          sql`${challenges.winner_id} IS NULL`
        )
      );

    const [pendingResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(challenges)
      .where(
        and(
          eq(challenges.status, 'pending'),
          eq(challenges.challengee_id, userId)
        )
      );

    res.json({
      wins: winsResult?.count ?? 0,
      losses: lossesResult?.count ?? 0,
      draws: drawsResult?.count ?? 0,
      pending_received: pendingResult?.count ?? 0,
    });
  } catch (err) {
    console.error('Challenge stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /challenges/search-users?q=username — search for users to challenge
router.get('/search-users', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const q = (req.query.q as string || '').trim();

    if (q.length < 2) {
      res.json({ users: [] });
      return;
    }

    const results = await db
      .select({
        id: users.id,
        username: users.username,
        avatar_url: users.avatar_url,
      })
      .from(users)
      .where(
        and(
          sql`${users.username} ILIKE ${`%${q}%`}`,
          sql`${users.id} != ${userId}`
        )
      )
      .limit(10);

    res.json({ users: results });
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /challenges/games — get games with odds for verified H2H game picker
router.get('/games', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const sport = req.query.sport as string;
    if (!sport) {
      res.status(400).json({ error: 'Sport parameter is required' });
      return;
    }

    const { getLiveOddsMultiLeague } = await import('../services/odds-api');
    const events = await getLiveOddsMultiLeague(sport);

    // Filter out games that have already started
    const now = new Date();
    const upcoming = events.filter((e) => new Date(e.commence_time) > now);

    res.json({ games: upcoming });
  } catch (err) {
    console.error('Challenge games error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /challenges/:id — get single challenge
router.get('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, req.params.id))
      .limit(1);

    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    if (challenge.challenger_id !== userId && challenge.challengee_id !== userId) {
      res.status(403).json({ error: 'Not authorized to view this challenge' });
      return;
    }

    // Enrich with user info
    const userIds = [challenge.challenger_id, challenge.challengee_id];
    if (challenge.winner_id) userIds.push(challenge.winner_id);

    const userRows = await db
      .select({ id: users.id, username: users.username, avatar_url: users.avatar_url })
      .from(users)
      .where(inArray(users.id, userIds));

    const userMap = new Map(userRows.map((u) => [u.id, { username: u.username, avatar_url: u.avatar_url }]));

    // Get scores for both users in this sport
    const scores = await db
      .select()
      .from(gammblerScores)
      .where(
        and(
          inArray(gammblerScores.user_id, [challenge.challenger_id, challenge.challengee_id]),
          eq(gammblerScores.sport, challenge.sport)
        )
      );

    const scoreMap = new Map(scores.map((s) => [s.user_id, parseFloat(String(s.score))]));

    res.json({
      challenge: {
        ...challenge,
        challenger: {
          ...userMap.get(challenge.challenger_id),
          score: scoreMap.get(challenge.challenger_id) ?? null,
        },
        challengee: {
          ...userMap.get(challenge.challengee_id),
          score: scoreMap.get(challenge.challengee_id) ?? null,
        },
        winner: challenge.winner_id ? userMap.get(challenge.winner_id) : null,
        is_challenger: challenge.challenger_id === userId,
      },
    });
  } catch (err) {
    console.error('Get challenge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /challenges — create a new challenge
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const body = createChallengeSchema.parse(req.body);

    // Look up challengee by username
    const [challengee] = await db
      .select({ id: users.id, username: users.username, email: users.email })
      .from(users)
      .where(eq(users.username, body.challengee_username))
      .limit(1);

    if (!challengee) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (challengee.id === userId) {
      res.status(400).json({ error: 'Cannot challenge yourself' });
      return;
    }

    // Check active challenge limit
    const [activeCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(challenges)
      .where(
        and(
          eq(challenges.challenger_id, userId),
          inArray(challenges.status, ['pending', 'accepted'])
        )
      );

    if ((activeCount?.count ?? 0) >= H2H_MAX_ACTIVE_CHALLENGES) {
      res.status(400).json({
        error: `Maximum ${H2H_MAX_ACTIVE_CHALLENGES} active challenges allowed`,
      });
      return;
    }

    // Get challenger username for notifications
    const [challenger] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Verified H2H: block challenges on games that have already started
    if (body.is_verified && body.event_start_time) {
      if (new Date(body.event_start_time) <= new Date()) {
        res.status(400).json({ error: 'Cannot create a challenge on a game that has already started' });
        return;
      }
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + H2H_CHALLENGE_EXPIRY_HOURS);

    const [created] = await db
      .insert(challenges)
      .values({
        challenger_id: userId,
        challengee_id: challengee.id,
        sport: body.sport as any,
        event_name: body.event_name,
        event_start_time: body.event_start_time ? new Date(body.event_start_time) : null,
        challenger_pick: body.challenger_pick,
        message: body.message || null,
        stake_display: body.stake_display || null,
        expires_at: expiresAt,
        // Verified H2H fields
        is_verified: body.is_verified || false,
        odds_api_event_id: body.odds_api_event_id || null,
        market: body.market || null,
        challenger_line: body.challenger_line != null ? String(body.challenger_line) : null,
        challenger_odds: body.challenger_odds || null,
        challengee_odds: body.challengee_odds || null,
        home_team: body.home_team || null,
        away_team: body.away_team || null,
      })
      .returning();

    // Create feed event
    await createFeedEvent(userId, 'h2h_challenge', {
      challenge_id: created.id,
      challenger_username: challenger?.username,
      challengee_username: challengee.username,
      event_name: body.event_name,
      sport: body.sport,
    }, body.sport);

    // Send notification (in-app + email + push, fire-and-forget)
    notifyChallengeReceived(
      challengee.id,
      challenger?.username || 'Someone',
      body.event_name,
      body.challenger_pick,
      body.sport,
      created.id,
    ).catch((err) => console.error('Challenge notification error:', err));

    res.status(201).json({ challenge: created });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Create challenge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /challenges/:id/accept — accept a challenge (provide your pick)
router.patch('/:id/accept', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { pick } = req.body;

    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, req.params.id))
      .limit(1);

    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    if (challenge.challengee_id !== userId) {
      res.status(403).json({ error: 'Only the challenged user can accept' });
      return;
    }

    if (challenge.status !== 'pending') {
      res.status(400).json({ error: `Challenge is already ${challenge.status}` });
      return;
    }

    if (new Date(challenge.expires_at) < new Date()) {
      await db.update(challenges)
        .set({ status: 'expired' })
        .where(eq(challenges.id, challenge.id));
      res.status(400).json({ error: 'Challenge has expired' });
      return;
    }

    // For verified challenges: auto-determine the opponent's pick
    let challengeePick: string;
    if (challenge.is_verified && challenge.market && challenge.home_team && challenge.away_team) {
      if (challenge.market === 'h2h') {
        // Moneyline: opponent gets the other team
        challengeePick = challenge.challenger_pick === challenge.home_team
          ? challenge.away_team
          : challenge.home_team;
      } else if (challenge.market === 'spreads') {
        // Spread: opponent gets the opposite side
        const line = parseFloat(String(challenge.challenger_line || 0));
        const isHome = challenge.challenger_pick.includes(challenge.home_team);
        const oppTeam = isHome ? challenge.away_team : challenge.home_team;
        const oppLine = -line;
        challengeePick = `${oppTeam} ${oppLine > 0 ? '+' : ''}${oppLine}`;
      } else if (challenge.market === 'totals') {
        // Totals: opponent gets the opposite side
        const line = parseFloat(String(challenge.challenger_line || 0));
        challengeePick = challenge.challenger_pick.toLowerCase().includes('over')
          ? `Under ${line}`
          : `Over ${line}`;
      } else {
        challengeePick = pick || '';
      }
    } else {
      // Custom challenge: pick is required
      if (!pick || typeof pick !== 'string' || pick.length === 0) {
        res.status(400).json({ error: 'Pick is required' });
        return;
      }
      challengeePick = pick;
    }

    const [updated] = await db
      .update(challenges)
      .set({ status: 'accepted', challengee_pick: challengeePick })
      .where(eq(challenges.id, challenge.id))
      .returning();

    // Notify challenger that challenge was accepted (fire-and-forget)
    const [accepter] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    notifyChallengeAccepted(
      challenge.challenger_id,
      accepter?.username || 'Someone',
      challenge.event_name,
      challenge.id,
    ).catch((err) => console.error('Challenge accepted notification error:', err));

    res.json({ challenge: updated });
  } catch (err) {
    console.error('Accept challenge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /challenges/:id/decline — decline a challenge
router.patch('/:id/decline', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, req.params.id))
      .limit(1);

    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    if (challenge.challengee_id !== userId) {
      res.status(403).json({ error: 'Only the challenged user can decline' });
      return;
    }

    if (challenge.status !== 'pending') {
      res.status(400).json({ error: `Challenge is already ${challenge.status}` });
      return;
    }

    const [updated] = await db
      .update(challenges)
      .set({ status: 'declined' })
      .where(eq(challenges.id, challenge.id))
      .returning();

    res.json({ challenge: updated });
  } catch (err) {
    console.error('Decline challenge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /challenges/:id/cancel — cancel own challenge (only challenger can cancel, only if pending)
router.patch('/:id/cancel', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, req.params.id))
      .limit(1);

    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    if (challenge.challenger_id !== userId) {
      res.status(403).json({ error: 'Only the challenger can cancel' });
      return;
    }

    if (challenge.status !== 'pending') {
      res.status(400).json({ error: `Cannot cancel a ${challenge.status} challenge` });
      return;
    }

    const [updated] = await db
      .update(challenges)
      .set({ status: 'cancelled' })
      .where(eq(challenges.id, challenge.id))
      .returning();

    res.json({ challenge: updated });
  } catch (err) {
    console.error('Cancel challenge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /challenges/:id/settle — settle a challenge (only custom challenges; verified auto-settle)
router.patch('/:id/settle', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const body = settleChallengeSchema.parse(req.body);

    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, req.params.id))
      .limit(1);

    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    // Block manual settlement of verified challenges
    if (challenge.is_verified) {
      res.status(400).json({ error: 'Verified challenges are automatically settled when the game completes. Manual settlement is not allowed.' });
      return;
    }

    if (challenge.challenger_id !== userId && challenge.challengee_id !== userId) {
      res.status(403).json({ error: 'Not a participant in this challenge' });
      return;
    }

    if (challenge.status !== 'accepted') {
      res.status(400).json({ error: 'Challenge must be accepted before settling' });
      return;
    }

    // Winner must be one of the participants (or null for a draw)
    const validWinners = [challenge.challenger_id, challenge.challengee_id];
    if (!validWinners.includes(body.winner_id)) {
      res.status(400).json({ error: 'Winner must be a participant in this challenge' });
      return;
    }

    const [updated] = await db
      .update(challenges)
      .set({
        status: 'settled',
        winner_id: body.winner_id,
        settled_at: new Date(),
        settlement_method: 'manual',
      })
      .where(eq(challenges.id, challenge.id))
      .returning();

    // Get user info for feed event
    const participantIds = [challenge.challenger_id, challenge.challengee_id];
    const userRows = await db
      .select({ id: users.id, username: users.username, email: users.email })
      .from(users)
      .where(inArray(users.id, participantIds));

    const userMap = new Map(userRows.map((u) => [u.id, u]));
    const winner = userMap.get(body.winner_id);
    const loserId = participantIds.find((id) => id !== body.winner_id)!;
    const loser = userMap.get(loserId);

    // Create feed event for the result
    await createFeedEvent(body.winner_id, 'h2h_result', {
      challenge_id: challenge.id,
      winner_username: winner?.username,
      loser_username: loser?.username,
      event_name: challenge.event_name,
      sport: challenge.sport,
      winner_pick: challenge.challenger_id === body.winner_id
        ? challenge.challenger_pick
        : challenge.challengee_pick,
    }, challenge.sport);

    // Check and award H2H badges
    await checkH2hBadges(body.winner_id).catch((err) =>
      console.error('H2H badge check error:', err)
    );

    // Send result notifications (in-app + email + push, fire-and-forget)
    if (winner) {
      notifyChallengeSettled(
        winner.id,
        true,
        loser?.username || 'opponent',
        challenge.event_name,
        challenge.id,
      ).catch((err) => console.error('Challenge settled notification error:', err));
    }
    if (loser) {
      notifyChallengeSettled(
        loser.id,
        false,
        winner?.username || 'opponent',
        challenge.event_name,
        challenge.id,
      ).catch((err) => console.error('Challenge settled notification error:', err));
    }

    res.json({ challenge: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Settle challenge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// H2H badge checking logic (exported for auto-settlement cron)
export async function checkH2hBadges(userId: string): Promise<void> {
  const existingBadges = await db
    .select({ badge_type: badges.badge_type })
    .from(badges)
    .where(eq(badges.user_id, userId));
  const has = new Set(existingBadges.map((b) => b.badge_type));

  // Count H2H wins (both manual and auto-settled)
  const [winsResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(challenges)
    .where(
      and(
        sql`${challenges.status} IN ('settled', 'auto_settled')`,
        eq(challenges.winner_id, userId)
      )
    );
  const wins = winsResult?.count ?? 0;

  // First H2H win
  if (!has.has('h2h_first_win') && wins >= 1) {
    await db.insert(badges).values({
      user_id: userId,
      badge_type: 'h2h_first_win' as any,
    }).onConflictDoNothing();
    await createFeedEvent(userId, 'badge_earned', {
      badge_type: 'h2h_first_win',
      badge_name: 'H2H First Win',
    });
  }

  // Check H2H win streak
  const recentSettled = await db
    .select({ winner_id: challenges.winner_id })
    .from(challenges)
    .where(
      and(
        sql`${challenges.status} IN ('settled', 'auto_settled')`,
        or(
          eq(challenges.challenger_id, userId),
          eq(challenges.challengee_id, userId)
        )
      )
    )
    .orderBy(desc(challenges.settled_at))
    .limit(10);

  let streak = 0;
  for (const c of recentSettled) {
    if (c.winner_id === userId) {
      streak++;
    } else {
      break;
    }
  }

  if (!has.has('h2h_streak_3') && streak >= 3) {
    await db.insert(badges).values({
      user_id: userId,
      badge_type: 'h2h_streak_3' as any,
    }).onConflictDoNothing();
    await createFeedEvent(userId, 'badge_earned', {
      badge_type: 'h2h_streak_3',
      badge_name: 'H2H 3-Win Streak',
    });
  }

  if (!has.has('h2h_streak_5') && streak >= 5) {
    await db.insert(badges).values({
      user_id: userId,
      badge_type: 'h2h_streak_5' as any,
    }).onConflictDoNothing();
    await createFeedEvent(userId, 'badge_earned', {
      badge_type: 'h2h_streak_5',
      badge_name: 'H2H 5-Win Streak',
    });
  }

  // H2H Champion — 10+ total wins
  if (!has.has('h2h_champion') && wins >= 10) {
    await db.insert(badges).values({
      user_id: userId,
      badge_type: 'h2h_champion' as any,
    }).onConflictDoNothing();
    await createFeedEvent(userId, 'badge_earned', {
      badge_type: 'h2h_champion',
      badge_name: 'H2H Champion',
    });
  }
}

export default router;
