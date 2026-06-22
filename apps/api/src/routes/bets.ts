import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { bets, users } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { attachTier, requirePro } from '../middleware/subscription';
import { updateAllScores } from '../services/gammbler-score';
import { checkAndAwardBadges } from '../services/badges';
import { findMatchingEvent, hasGameStarted } from '../services/game-times';
import { settlePendingBets } from '../services/auto-settle';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const createBetSchema = z.object({
  platform: z.enum([
    'draftkings', 'fanduel', 'betmgm', 'caesars', 'espn_bet', 'pointsbet',
    'wynnbet', 'prizepicks', 'underdog', 'espn_fantasy', 'yahoo_fantasy', 'other',
  ]),
  sport: z.enum(['nfl', 'nba', 'mlb', 'nhl', 'cfb', 'cbb', 'soccer', 'prizepicks', 'dfs']),
  league: z.string().optional(),
  bet_type: z.enum(['spread', 'moneyline', 'over_under', 'parlay', 'prop', 'player_prop', 'teaser', 'futures', 'other']),
  selection: z.string().min(1),
  odds: z.number(),
  stake: z.number().positive(),
  result: z.enum(['win', 'loss', 'push', 'pending']).optional().default('pending'),
  event_name: z.string().optional(),
  parlay_legs: z.number().int().positive().optional(),
  odds_api_event_id: z.string().optional(),
  event_start_time: z.string().optional(),
});

// GET /bets — list user's bets
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const sport = req.query.sport as string;
    const platform = req.query.platform as string;
    const result = req.query.result as string;

    let query = db
      .select()
      .from(bets)
      .where(eq(bets.user_id, req.user!.userId))
      .orderBy(desc(bets.created_at))
      .limit(limit)
      .offset(offset);

    const userBets = await query;

    // Apply filters in-memory for simplicity (drizzle dynamic where)
    let filtered = userBets;
    if (sport) filtered = filtered.filter((b) => b.sport === sport);
    if (platform) filtered = filtered.filter((b) => b.platform === platform);
    if (result) filtered = filtered.filter((b) => b.result === result);

    res.json({ bets: filtered, limit, offset });
  } catch (err) {
    console.error('List bets error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /bets — create a bet from the game picker (or Pro CSV/SharpSports)
router.post('/', authMiddleware, attachTier, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = createBetSchema.parse(req.body);
    const userId = req.user!.userId;
    const isPro = req.userTier === 'pro';

    let eventStartTime: Date | null = null;
    let oddsApiEventId: string | null = body.odds_api_event_id || null;
    let isPregameVerified = false;

    // Use directly-provided event data from the game picker
    if (body.event_start_time) {
      eventStartTime = new Date(body.event_start_time);
    }

    if (!isPro) {
      // Free users MUST submit bets as 'pending'
      if (body.result !== 'pending') {
        res.status(403).json({
          error: 'Bets must be submitted before the game starts and will be settled automatically when it ends.',
          code: 'RESULT_NOT_ALLOWED',
        });
        return;
      }

      // Free users MUST pick from real games — odds_api_event_id is required
      if (!oddsApiEventId) {
        // Fallback: try to match event from selection text
        const matchedEvent = await findMatchingEvent(body.sport, body.selection, body.event_name);
        if (matchedEvent) {
          eventStartTime = matchedEvent.commenceTime;
          oddsApiEventId = matchedEvent.eventId;
        } else {
          res.status(400).json({
            error: 'You must pick a game from the available games list. Free-text bet entry is no longer supported.',
            code: 'GAME_REQUIRED',
          });
          return;
        }
      }

      // Check if game has started
      if (eventStartTime && hasGameStarted(eventStartTime)) {
        res.status(403).json({
          error: 'This game has already started. You can only place bets before the game begins.',
          code: 'GAME_STARTED',
        });
        return;
      }

      isPregameVerified = true;
    } else {
      // Pro users: still try to match event for data enrichment if no event ID provided
      if (!oddsApiEventId) {
        const matchedEvent = await findMatchingEvent(body.sport, body.selection, body.event_name);
        if (matchedEvent) {
          eventStartTime = matchedEvent.commenceTime;
          oddsApiEventId = matchedEvent.eventId;
          isPregameVerified = !hasGameStarted(matchedEvent.commenceTime);
        }
      } else {
        isPregameVerified = eventStartTime ? !hasGameStarted(eventStartTime) : false;
      }
    }

    const profitLoss = body.result === 'win'
      ? calculatePayout(body.odds, body.stake) - body.stake
      : body.result === 'loss'
        ? -body.stake
        : 0;

    const [bet] = await db
      .insert(bets)
      .values({
        user_id: userId,
        platform: body.platform,
        sport: body.sport,
        league: body.league,
        bet_type: body.bet_type,
        selection: body.selection,
        odds: String(body.odds),
        stake: String(body.stake),
        result: body.result,
        profit_loss: String(profitLoss),
        is_manual: true,
        settled_at: body.result !== 'pending' ? new Date() : null,
        event_name: body.event_name,
        parlay_legs: body.parlay_legs,
        event_start_time: eventStartTime,
        is_pregame_verified: isPregameVerified,
        odds_api_event_id: oddsApiEventId,
      })
      .returning();

    // Recalculate scores if bet is settled
    if (body.result !== 'pending') {
      await updateAllScores(userId);
      await checkAndAwardBadges(userId);
    }

    res.status(201).json({
      bet,
      pregame_verified: isPregameVerified,
      ...(eventStartTime && { event_start_time: eventStartTime.toISOString() }),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Create bet error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /bets/:id/settle — disabled for users; bets are now auto-settled
router.patch('/:id/settle', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  res.status(403).json({
    error: 'Bets are now settled automatically when the game ends. You can no longer manually settle bets.',
    code: 'MANUAL_SETTLE_DISABLED',
  });
});

// POST /bets/auto-settle — trigger auto-settlement (founder only)
router.post('/auto-settle', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // Only allow the founder to trigger manual settlement
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (!user || user.email !== 'l.doeden1018@gmail.com') {
      res.status(403).json({ error: 'Only the founder can trigger auto-settlement' });
      return;
    }

    const result = await settlePendingBets();
    res.json({
      message: 'Auto-settlement complete',
      ...result,
    });
  } catch (err) {
    console.error('Manual auto-settle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /bets/upcoming-events — get upcoming events for a sport (for pre-game bet entry)
router.get('/upcoming-events', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const sport = req.query.sport as string;
    if (!sport) {
      res.status(400).json({ error: 'Sport parameter required' });
      return;
    }

    const { getUpcomingEvents } = await import('../services/game-times');
    const events = await getUpcomingEvents(sport);

    res.json({
      events: events.map(e => ({
        id: e.id,
        home_team: e.home_team,
        away_team: e.away_team,
        commence_time: e.commence_time,
        display: `${e.away_team} @ ${e.home_team}`,
      })),
    });
  } catch (err) {
    console.error('Upcoming events error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /bets/games-with-odds — get games with full odds for the "Pick a Game" flow
router.get('/games-with-odds', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const sport = req.query.sport as string;
    if (!sport) {
      res.status(400).json({ error: 'Sport parameter required' });
      return;
    }

    const { getLiveOdds, mapSportToOddsApiKey } = await import('../services/odds-api');
    const sportKey = mapSportToOddsApiKey(sport);
    const events = await getLiveOdds(sportKey);

    // Sort by commence time (soonest first), filter out started games at end
    const sorted = events.sort((a, b) => 
      new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()
    );

    res.json({ games: sorted });
  } catch (err) {
    console.error('Games with odds error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /bets/csv-import — import bets from CSV
router.post('/csv-import', authMiddleware, requirePro, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const platform = req.body.platform as string;
    if (!platform) {
      res.status(400).json({ error: 'Platform is required' });
      return;
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const importedBets = [];
    for (const record of records) {
      try {
        const mapped = mapCSVRecord(record, platform, req.user!.userId);
        if (!mapped) continue;

        const [bet] = await db
          .insert(bets)
          .values(mapped)
          .returning();

        importedBets.push(bet);
      } catch {
        // Skip invalid rows
        continue;
      }
    }

    // Recalculate scores after bulk import
    if (importedBets.length > 0) {
      await updateAllScores(req.user!.userId);
      await checkAndAwardBadges(req.user!.userId);
    }

    res.json({
      imported: importedBets.length,
      total: records.length,
      bets: importedBets,
    });
  } catch (err) {
    console.error('CSV import error:', err);
    res.status(500).json({ error: 'Failed to import CSV' });
  }
});

// GET /bets/stats — get user's betting stats
router.get('/stats', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const sport = req.query.sport as string;
    const platform = req.query.platform as string;
    const timeFilter = req.query.time as string; // week, month, year, all

    const allBets = await db
      .select()
      .from(bets)
      .where(eq(bets.user_id, req.user!.userId));

    let filtered = allBets;
    if (sport) filtered = filtered.filter((b) => b.sport === sport);
    if (platform) filtered = filtered.filter((b) => b.platform === platform);

    if (timeFilter) {
      const now = new Date();
      let cutoff: Date;
      switch (timeFilter) {
        case 'week':
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          cutoff = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          cutoff = new Date(0);
      }
      filtered = filtered.filter((b) => new Date(b.created_at) >= cutoff);
    }

    const settled = filtered.filter((b) => ['win', 'loss', 'push'].includes(b.result));
    const wins = settled.filter((b) => b.result === 'win').length;
    const losses = settled.filter((b) => b.result === 'loss').length;
    const pushes = settled.filter((b) => b.result === 'push').length;
    const totalStake = settled.reduce((sum, b) => sum + parseFloat(String(b.stake)), 0);
    const totalPL = settled.reduce((sum, b) => sum + parseFloat(String(b.profit_loss || '0')), 0);
    const roi = totalStake > 0 ? (totalPL / totalStake) * 100 : 0;

    // Calculate current streak
    const sortedSettled = settled
      .filter((b) => b.result !== 'push')
      .sort((a, b) => new Date(b.settled_at!).getTime() - new Date(a.settled_at!).getTime());

    let streak = 0;
    let streakType = '';
    if (sortedSettled.length > 0) {
      streakType = sortedSettled[0].result;
      for (const bet of sortedSettled) {
        if (bet.result === streakType) streak++;
        else break;
      }
    }

    // Breakdown by sport
    const bySport: Record<string, { wins: number; losses: number; pushes: number; roi: number }> = {};
    for (const bet of settled) {
      if (!bySport[bet.sport]) {
        bySport[bet.sport] = { wins: 0, losses: 0, pushes: 0, roi: 0 };
      }
      if (bet.result === 'win') bySport[bet.sport].wins++;
      if (bet.result === 'loss') bySport[bet.sport].losses++;
      if (bet.result === 'push') bySport[bet.sport].pushes++;
    }

    // Breakdown by bet type
    const byBetType: Record<string, { wins: number; losses: number; pushes: number; roi: number }> = {};
    for (const bet of settled) {
      if (!byBetType[bet.bet_type]) {
        byBetType[bet.bet_type] = { wins: 0, losses: 0, pushes: 0, roi: 0 };
      }
      if (bet.result === 'win') byBetType[bet.bet_type].wins++;
      if (bet.result === 'loss') byBetType[bet.bet_type].losses++;
      if (bet.result === 'push') byBetType[bet.bet_type].pushes++;
    }

    res.json({
      record: { wins, losses, pushes },
      roi: Math.round(roi * 100) / 100,
      total_profit_loss: Math.round(totalPL * 100) / 100,
      total_stake: Math.round(totalStake * 100) / 100,
      current_streak: { count: streak, type: streakType },
      pending_count: filtered.filter((b) => b.result === 'pending').length,
      by_sport: bySport,
      by_bet_type: byBetType,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function calculatePayout(americanOdds: number, stake: number): number {
  if (americanOdds > 0) {
    return stake + (stake * americanOdds) / 100;
  }
  return stake + (stake * 100) / Math.abs(americanOdds);
}

function mapCSVRecord(record: Record<string, string>, platform: string, userId: string): typeof bets.$inferInsert | null {
  const sport = inferSport(record.sport || record.Sport || record.league || record.League || '');
  const betType = inferBetType(record.type || record.Type || record.bet_type || record.market || '');
  const selection = record.selection || record.Selection || record.pick || record.Pick || record.description || '';
  const oddsStr = record.odds || record.Odds || record.price || record.Price || '0';
  const stakeStr = record.stake || record.Stake || record.wager || record.Wager || record.amount || '0';
  const resultStr = (record.result || record.Result || record.outcome || record.Outcome || 'pending').toLowerCase();

  if (!selection) return null;

  const odds = parseFloat(oddsStr) || 0;
  const stake = parseFloat(stakeStr.replace(/[^0-9.-]/g, '')) || 0;
  if (stake <= 0) return null;

  const result: 'win' | 'loss' | 'push' | 'pending' = resultStr.includes('win') || resultStr.includes('won') ? 'win'
    : resultStr.includes('loss') || resultStr.includes('lost') ? 'loss'
    : resultStr.includes('push') || resultStr.includes('tie') ? 'push'
    : 'pending';

  const profitLoss = result === 'win'
    ? calculatePayout(odds, stake) - stake
    : result === 'loss' ? -stake : 0;

  return {
    user_id: userId,
    platform: platform as any,
    sport: sport as any,
    bet_type: betType as any,
    selection,
    odds: String(odds),
    stake: String(stake),
    result,
    profit_loss: String(profitLoss),
    settled_at: result !== 'pending' ? new Date() : null,
    is_manual: true,
    event_name: record.event || record.Event || record.game || record.Game || null,
  };
}

function inferSport(sportStr: string): string {
  const s = sportStr.toLowerCase();
  if (s.includes('nfl') || s.includes('football')) return 'nfl';
  if (s.includes('nba') || s.includes('basketball')) return 'nba';
  if (s.includes('mlb') || s.includes('baseball')) return 'mlb';
  if (s.includes('nhl') || s.includes('hockey')) return 'nhl';
  if (s.includes('cfb') || s.includes('college football') || s.includes('ncaaf')) return 'cfb';
  if (s.includes('cbb') || s.includes('college basketball') || s.includes('ncaab')) return 'cbb';
  if (s.includes('soccer') || s.includes('mls') || s.includes('epl')) return 'soccer';
  if (s.includes('prizepick')) return 'prizepicks';
  if (s.includes('dfs') || s.includes('fantasy')) return 'dfs';
  return 'nfl'; // default
}

// POST /bets/parse-screenshot — parse a sportsbook screenshot using GPT-4 Vision
const screenshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

router.post('/parse-screenshot', authMiddleware, screenshotUpload.single('screenshot'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No screenshot file provided' });
      return;
    }

    const { parseScreenshot } = await import('../services/screenshot-parser');
    const base64Image = req.file.buffer.toString('base64');
    const parsed = await parseScreenshot(base64Image);

    res.json({
      success: true,
      parsed,
      message: parsed.confidence >= 70
        ? 'Screenshot parsed successfully. Please review the pre-filled fields.'
        : 'Low confidence parsing. Please verify all fields carefully.',
    });
  } catch (err) {
    console.error('Screenshot parse error:', err);
    const message = err instanceof Error ? err.message : 'Failed to parse screenshot';
    if (message.includes('OPENAI_API_KEY not configured')) {
      res.status(503).json({ error: 'Screenshot parsing is not yet configured. Please enter your bet manually.' });
    } else {
      res.status(500).json({ error: 'Failed to parse screenshot. Please try again or enter your bet manually.' });
    }
  }
});

function inferBetType(typeStr: string): string {
  const t = typeStr.toLowerCase();
  if (t.includes('spread')) return 'spread';
  if (t.includes('money') || t.includes('ml')) return 'moneyline';
  if (t.includes('over') || t.includes('under') || t.includes('total')) return 'over_under';
  if (t.includes('parlay')) return 'parlay';
  if (t.includes('player') && t.includes('prop')) return 'player_prop';
  if (t.includes('prop')) return 'prop';
  if (t.includes('teaser')) return 'teaser';
  if (t.includes('future')) return 'futures';
  return 'other';
}

export default router;
