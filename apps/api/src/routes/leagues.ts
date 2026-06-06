import { Router, Request, Response } from 'express';
import { db } from '../db';
import { leagues, leagueMembers, leagueWeeklyScores, leagueAwards, users, bets } from '../db/schema';
import { eq, and, desc, asc, sql, inArray, gte, lte, count } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { requirePro, attachTier } from '../middleware/subscription';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const router = Router();

// Generate a random invite code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Calculate current week number for a league
function getWeekNumber(seasonStart: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - seasonStart.getTime();
  return Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));
}

// Get week boundaries
function getWeekBoundaries(seasonStart: Date, weekNumber: number): { start: Date; end: Date } {
  const start = new Date(seasonStart.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start, end };
}

const createLeagueSchema = z.object({
  name: z.string().min(3).max(100),
  sport: z.enum(['all', 'nfl', 'nba', 'mlb', 'nhl', 'cfb', 'cbb', 'soccer', 'mma']),
  season_name: z.string().max(100).optional(),
  season_start: z.string(),
  season_end: z.string(),
  min_bets_per_week: z.number().int().min(1).max(20).default(1),
  max_members: z.number().int().min(2).max(50).default(20),
  is_cash_league: z.boolean().optional().default(false),
  buy_in_cents: z.number().int().min(0).max(50000).optional().default(0),
});

// POST /leagues — Create a league (PRO only)
router.post('/', authMiddleware, requirePro, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const parsed = createLeagueSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
      return;
    }

    const { name, sport, season_name, season_start, season_end, min_bets_per_week, max_members, is_cash_league, buy_in_cents } = parsed.data;

    // Cash leagues are currently disabled — free leagues only
    if (is_cash_league && buy_in_cents > 0) {
      res.status(400).json({ error: 'Cash leagues are coming soon. Create a free league for now!' });
      return;
    }

    // Check how many leagues the user has created
    const [leagueCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leagues)
      .where(eq(leagues.commissioner_id, userId));

    if ((leagueCount?.count || 0) >= 10) {
      res.status(400).json({ error: 'Maximum 10 leagues per user' });
      return;
    }

    const inviteCode = generateInviteCode();

    const [league] = await db.insert(leagues).values({
      name,
      sport,
      season_name: season_name || `${name} Season`,
      season_start: new Date(season_start),
      season_end: new Date(season_end),
      commissioner_id: userId,
      invite_code: inviteCode,
      min_bets_per_week,
      max_members,
      is_cash_league: is_cash_league || false,
      buy_in_cents: buy_in_cents || 0,
    }).returning();

    // Add commissioner as a member
    await db.insert(leagueMembers).values({
      league_id: league.id,
      user_id: userId,
      role: 'commissioner',
    });

    res.status(201).json({ league });
  } catch (err) {
    console.error('Create league error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /leagues — Get user's leagues
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const memberRows = await db
      .select({
        league_id: leagueMembers.league_id,
        role: leagueMembers.role,
        season_score: leagueMembers.season_score,
        active_weeks: leagueMembers.active_weeks,
        total_weeks: leagueMembers.total_weeks,
      })
      .from(leagueMembers)
      .where(eq(leagueMembers.user_id, userId));

    if (memberRows.length === 0) {
      res.json({ leagues: [] });
      return;
    }

    const leagueIds = memberRows.map((m) => m.league_id);

    const leagueRows = await db
      .select({
        id: leagues.id,
        name: leagues.name,
        sport: leagues.sport,
        status: leagues.status,
        season_name: leagues.season_name,
        season_start: leagues.season_start,
        season_end: leagues.season_end,
        invite_code: leagues.invite_code,
        min_bets_per_week: leagues.min_bets_per_week,
        max_members: leagues.max_members,
        commissioner_id: leagues.commissioner_id,
        created_at: leagues.created_at,
      })
      .from(leagues)
      .where(inArray(leagues.id, leagueIds))
      .orderBy(desc(leagues.created_at));

    // Get member counts for each league
    const memberCounts = await db
      .select({
        league_id: leagueMembers.league_id,
        count: sql<number>`count(*)`,
      })
      .from(leagueMembers)
      .where(inArray(leagueMembers.league_id, leagueIds))
      .groupBy(leagueMembers.league_id);

    const countMap = new Map(memberCounts.map((mc) => [mc.league_id, mc.count]));

    const result = leagueRows.map((league) => {
      const membership = memberRows.find((m) => m.league_id === league.id);
      return {
        ...league,
        member_count: countMap.get(league.id) || 0,
        my_role: membership?.role,
        my_score: membership?.season_score,
        my_active_weeks: membership?.active_weeks,
      };
    });

    res.json({ leagues: result });
  } catch (err) {
    console.error('Get leagues error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /leagues/:id — Get league details with standings
router.get('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const leagueId = req.params.id;

    // Verify user is a member
    const [membership] = await db
      .select()
      .from(leagueMembers)
      .where(and(eq(leagueMembers.league_id, leagueId), eq(leagueMembers.user_id, userId)))
      .limit(1);

    if (!membership) {
      res.status(403).json({ error: 'Not a member of this league' });
      return;
    }

    // Get league info
    const [league] = await db
      .select()
      .from(leagues)
      .where(eq(leagues.id, leagueId))
      .limit(1);

    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    // Get all members with standings
    const members = await db
      .select({
        user_id: leagueMembers.user_id,
        username: users.username,
        avatar_url: users.avatar_url,
        role: leagueMembers.role,
        season_score: leagueMembers.season_score,
        active_weeks: leagueMembers.active_weeks,
        total_weeks: leagueMembers.total_weeks,
        total_bets_in_league: leagueMembers.total_bets_in_league,
        best_week_score: leagueMembers.best_week_score,
        current_streak: leagueMembers.current_streak,
        joined_at: leagueMembers.joined_at,
      })
      .from(leagueMembers)
      .innerJoin(users, eq(users.id, leagueMembers.user_id))
      .where(eq(leagueMembers.league_id, leagueId))
      .orderBy(desc(leagueMembers.season_score));

    // Rank members
    const standings = members.map((m, i) => ({
      rank: i + 1,
      ...m,
      is_self: m.user_id === userId,
      is_commissioner: m.role === 'commissioner',
    }));

    // Get current week number
    const currentWeek = getWeekNumber(league.season_start);

    res.json({ league, standings, current_week: currentWeek });
  } catch (err) {
    console.error('Get league details error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /leagues/:id/weekly — Get weekly scores for a league
router.get('/:id/weekly', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const leagueId = req.params.id;
    const weekNum = parseInt(req.query.week as string) || undefined;

    // Verify membership
    const [membership] = await db
      .select()
      .from(leagueMembers)
      .where(and(eq(leagueMembers.league_id, leagueId), eq(leagueMembers.user_id, userId)))
      .limit(1);

    if (!membership) {
      res.status(403).json({ error: 'Not a member of this league' });
      return;
    }

    let query = db
      .select({
        user_id: leagueWeeklyScores.user_id,
        username: users.username,
        week_number: leagueWeeklyScores.week_number,
        score: leagueWeeklyScores.score,
        bets_placed: leagueWeeklyScores.bets_placed,
        wins: leagueWeeklyScores.wins,
        losses: leagueWeeklyScores.losses,
        roi: leagueWeeklyScores.roi,
        met_minimum: leagueWeeklyScores.met_minimum,
      })
      .from(leagueWeeklyScores)
      .innerJoin(users, eq(users.id, leagueWeeklyScores.user_id))
      .where(
        weekNum
          ? and(eq(leagueWeeklyScores.league_id, leagueId), eq(leagueWeeklyScores.week_number, weekNum))
          : eq(leagueWeeklyScores.league_id, leagueId)
      )
      .orderBy(desc(leagueWeeklyScores.week_number), desc(leagueWeeklyScores.score));

    const weeklyScores = await query;

    res.json({ weekly_scores: weeklyScores });
  } catch (err) {
    console.error('Get weekly scores error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /leagues/join — Join a league via invite code (free users can join up to 2)
router.post('/join', authMiddleware, attachTier, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { invite_code } = req.body;

    if (!invite_code) {
      res.status(400).json({ error: 'Invite code required' });
      return;
    }

    // Find league by invite code
    const [league] = await db
      .select()
      .from(leagues)
      .where(eq(leagues.invite_code, invite_code.toUpperCase()))
      .limit(1);

    if (!league) {
      res.status(404).json({ error: 'Invalid invite code' });
      return;
    }

    if (league.status !== 'active') {
      res.status(400).json({ error: 'This league is no longer accepting members' });
      return;
    }

    // Check if already a member
    const [existing] = await db
      .select()
      .from(leagueMembers)
      .where(and(eq(leagueMembers.league_id, league.id), eq(leagueMembers.user_id, userId)))
      .limit(1);

    if (existing) {
      res.status(400).json({ error: 'Already a member of this league' });
      return;
    }

    // Check member count
    const [memberCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leagueMembers)
      .where(eq(leagueMembers.league_id, league.id));

    if ((memberCount?.count || 0) >= league.max_members) {
      res.status(400).json({ error: 'League is full' });
      return;
    }

    // Check free user league limit (max 2)
    if (req.userTier === 'free') {
      const [userLeagueCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(leagueMembers)
        .where(eq(leagueMembers.user_id, userId));

      if ((userLeagueCount?.count || 0) >= 2) {
        res.status(403).json({
          error: 'Free users can join up to 2 leagues. Upgrade to Pro for unlimited.',
          upgrade: true,
        });
        return;
      }
    }

    // Add member
    await db.insert(leagueMembers).values({
      league_id: league.id,
      user_id: userId,
      role: 'member',
    });

    res.status(201).json({ message: 'Joined league successfully', league });
  } catch (err) {
    console.error('Join league error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /leagues/:id/leave — Leave a league
router.delete('/:id/leave', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const leagueId = req.params.id;

    const [membership] = await db
      .select()
      .from(leagueMembers)
      .where(and(eq(leagueMembers.league_id, leagueId), eq(leagueMembers.user_id, userId)))
      .limit(1);

    if (!membership) {
      res.status(404).json({ error: 'Not a member of this league' });
      return;
    }

    if (membership.role === 'commissioner') {
      res.status(400).json({ error: 'Commissioners cannot leave their own league. Transfer ownership or delete the league.' });
      return;
    }

    await db
      .delete(leagueMembers)
      .where(and(eq(leagueMembers.league_id, leagueId), eq(leagueMembers.user_id, userId)));

    res.json({ message: 'Left league successfully' });
  } catch (err) {
    console.error('Leave league error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /leagues/:id — Delete a league (commissioner only)
router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const leagueId = req.params.id;

    const [league] = await db
      .select()
      .from(leagues)
      .where(eq(leagues.id, leagueId))
      .limit(1);

    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    if (league.commissioner_id !== userId) {
      res.status(403).json({ error: 'Only the commissioner can delete a league' });
      return;
    }

    await db.delete(leagues).where(eq(leagues.id, leagueId));

    res.json({ message: 'League deleted successfully' });
  } catch (err) {
    console.error('Delete league error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /leagues/:id/settings — Update league settings (commissioner only)
router.put('/:id/settings', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const leagueId = req.params.id;

    const [league] = await db
      .select()
      .from(leagues)
      .where(eq(leagues.id, leagueId))
      .limit(1);

    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    if (league.commissioner_id !== userId) {
      res.status(403).json({ error: 'Only the commissioner can update settings' });
      return;
    }

    const { name, min_bets_per_week, max_members } = req.body;

    const updates: Record<string, any> = {};
    if (name) updates.name = name;
    if (min_bets_per_week) updates.min_bets_per_week = min_bets_per_week;
    if (max_members) updates.max_members = max_members;

    if (Object.keys(updates).length > 0) {
      await db.update(leagues).set(updates).where(eq(leagues.id, leagueId));
    }

    res.json({ message: 'League settings updated' });
  } catch (err) {
    console.error('Update league settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /leagues/:id/awards — Get league awards
router.get('/:id/awards', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const leagueId = req.params.id;

    // Verify membership
    const [membership] = await db
      .select()
      .from(leagueMembers)
      .where(and(eq(leagueMembers.league_id, leagueId), eq(leagueMembers.user_id, userId)))
      .limit(1);

    if (!membership) {
      res.status(403).json({ error: 'Not a member of this league' });
      return;
    }

    const awards = await db
      .select({
        id: leagueAwards.id,
        user_id: leagueAwards.user_id,
        username: users.username,
        award_type: leagueAwards.award_type,
        award_name: leagueAwards.award_name,
        description: leagueAwards.description,
        awarded_at: leagueAwards.awarded_at,
      })
      .from(leagueAwards)
      .innerJoin(users, eq(users.id, leagueAwards.user_id))
      .where(eq(leagueAwards.league_id, leagueId))
      .orderBy(desc(leagueAwards.awarded_at));

    res.json({ awards });
  } catch (err) {
    console.error('Get awards error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /leagues/:id/kick — Remove a member (commissioner only)
router.post('/:id/kick', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const leagueId = req.params.id;
    const { target_user_id } = req.body;

    if (!target_user_id) {
      res.status(400).json({ error: 'target_user_id required' });
      return;
    }

    const [league] = await db
      .select()
      .from(leagues)
      .where(eq(leagues.id, leagueId))
      .limit(1);

    if (!league || league.commissioner_id !== userId) {
      res.status(403).json({ error: 'Only the commissioner can remove members' });
      return;
    }

    if (target_user_id === userId) {
      res.status(400).json({ error: 'Cannot kick yourself' });
      return;
    }

    await db
      .delete(leagueMembers)
      .where(and(eq(leagueMembers.league_id, leagueId), eq(leagueMembers.user_id, target_user_id)));

    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error('Kick member error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
