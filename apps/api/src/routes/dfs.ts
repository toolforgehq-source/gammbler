import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  dfsContests, dfsScores, dfsScoreSnapshots, dfsBadges, dfsCsvImports,
  users, follows,
} from '../db/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { attachTier, requirePro } from '../middleware/subscription';
import { z } from 'zod';
import { calculateDfsScore } from '../services/dfs-scoring';
import { checkAndAwardDfsBadges } from '../services/dfs-badges';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Contest Entry (Manual) ──────────────────────────────────

const addContestSchema = z.object({
  platform: z.enum(['draftkings', 'fanduel', 'yahoo', 'underdog', 'prizepicks', 'other']),
  sport: z.enum(['nfl', 'nba', 'mlb', 'nhl', 'pga', 'nascar', 'soccer', 'mma', 'cfb', 'cbb']),
  contest_type: z.enum(['cash', 'gpp', 'h2h', 'fifty_fifty', 'multiplier', 'satellite', 'other']),
  contest_name: z.string().optional(),
  entry_fee: z.number().min(0),
  payout: z.number().min(0),
  finish_position: z.number().int().min(1).optional(),
  total_entries: z.number().int().min(1).optional(),
  points_scored: z.number().optional(),
  contest_date: z.string(),
});

router.post('/contests', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = addContestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() });
      return;
    }

    const data = parsed.data;

    const [contest] = await db.insert(dfsContests).values({
      user_id: req.user!.userId,
      platform: data.platform,
      sport: data.sport,
      contest_type: data.contest_type,
      contest_name: data.contest_name || null,
      entry_fee_cents: Math.round(data.entry_fee * 100),
      payout_cents: Math.round(data.payout * 100),
      finish_position: data.finish_position || null,
      total_entries: data.total_entries || null,
      points_scored: data.points_scored ? String(data.points_scored) : null,
      is_manual: true,
      contest_date: new Date(data.contest_date),
    }).returning();

    // Recalculate DFS score and check badges
    await calculateDfsScore(req.user!.userId);
    const newBadges = await checkAndAwardDfsBadges(req.user!.userId);

    res.status(201).json({ contest, newBadges });
  } catch (err) {
    console.error('Add DFS contest error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── List Contests ───────────────────────────────────────────

router.get('/contests', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const sport = req.query.sport as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const conditions = [eq(dfsContests.user_id, req.user!.userId)];
    if (sport && sport !== 'overall') {
      conditions.push(eq(dfsContests.sport, sport as any));
    }

    const contests = await db
      .select()
      .from(dfsContests)
      .where(and(...conditions))
      .orderBy(desc(dfsContests.contest_date))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dfsContests)
      .where(and(...conditions));

    res.json({ contests, total: countResult?.count || 0 });
  } catch (err) {
    console.error('List DFS contests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Contest Stats ───────────────────────────────────────────

router.get('/stats', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const contests = await db
      .select({
        entry_fee_cents: dfsContests.entry_fee_cents,
        payout_cents: dfsContests.payout_cents,
        contest_type: dfsContests.contest_type,
        sport: dfsContests.sport,
      })
      .from(dfsContests)
      .where(eq(dfsContests.user_id, req.user!.userId));

    const totalContests = contests.length;
    const totalEntryFees = contests.reduce((s, c) => s + c.entry_fee_cents, 0);
    const totalPayouts = contests.reduce((s, c) => s + c.payout_cents, 0);
    const totalProfit = totalPayouts - totalEntryFees;
    const cashed = contests.filter((c) => c.payout_cents > 0).length;
    const roi = totalEntryFees > 0 ? ((totalPayouts - totalEntryFees) / totalEntryFees) * 100 : 0;
    const cashRate = totalContests > 0 ? (cashed / totalContests) * 100 : 0;

    // By contest type
    const byType: Record<string, { count: number; fees: number; payouts: number }> = {};
    for (const c of contests) {
      if (!byType[c.contest_type]) byType[c.contest_type] = { count: 0, fees: 0, payouts: 0 };
      byType[c.contest_type].count++;
      byType[c.contest_type].fees += c.entry_fee_cents;
      byType[c.contest_type].payouts += c.payout_cents;
    }

    // By sport
    const bySport: Record<string, { count: number; fees: number; payouts: number }> = {};
    for (const c of contests) {
      if (!bySport[c.sport]) bySport[c.sport] = { count: 0, fees: 0, payouts: 0 };
      bySport[c.sport].count++;
      bySport[c.sport].fees += c.entry_fee_cents;
      bySport[c.sport].payouts += c.payout_cents;
    }

    res.json({
      total_contests: totalContests,
      total_entry_fees: totalEntryFees / 100,
      total_payouts: totalPayouts / 100,
      total_profit: totalProfit / 100,
      roi: Math.round(roi * 100) / 100,
      cash_rate: Math.round(cashRate * 100) / 100,
      cashed,
      by_type: byType,
      by_sport: bySport,
    });
  } catch (err) {
    console.error('DFS stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DFS Scores ──────────────────────────────────────────────

router.get('/scores', authMiddleware, attachTier, async (req: Request, res: Response): Promise<void> => {
  try {
    const scores = await db
      .select()
      .from(dfsScores)
      .where(eq(dfsScores.user_id, req.user!.userId));

    if (req.userTier === 'free') {
      const overall = scores.find((s) => s.sport === 'overall');
      const locked = scores
        .filter((s) => s.sport !== 'overall')
        .map((s) => ({ sport: s.sport, score: null, is_unlocked: false, total_contests: s.total_contests, locked: true }));
      res.json({ scores: overall ? [overall, ...locked] : locked, tier: 'free' });
      return;
    }

    res.json({ scores, tier: 'pro' });
  } catch (err) {
    console.error('Get DFS scores error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /dfs/scores/user/:userId — public DFS scores for a user
router.get('/scores/user/:userId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const [user] = await db
      .select({ is_profile_public: users.is_profile_public })
      .from(users)
      .where(eq(users.id, req.params.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const scores = await db
      .select({
        sport: dfsScores.sport,
        score: dfsScores.score,
        is_unlocked: dfsScores.is_unlocked,
        total_contests: dfsScores.total_contests,
        roi: dfsScores.roi,
        cash_rate: dfsScores.cash_rate,
        calculated_at: dfsScores.calculated_at,
      })
      .from(dfsScores)
      .where(eq(dfsScores.user_id, req.params.userId));

    res.json({ scores, is_private: !user.is_profile_public });
  } catch (err) {
    console.error('Get user DFS scores error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DFS Leaderboards ────────────────────────────────────────

router.get('/leaderboards/:sport/national', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const sport = req.params.sport;
    const userId = req.user!.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const scores = await db
      .select({
        user_id: dfsScores.user_id,
        username: users.username,
        avatar_url: users.avatar_url,
        score: dfsScores.score,
        total_contests: dfsScores.total_contests,
        roi: dfsScores.roi,
        cash_rate: dfsScores.cash_rate,
      })
      .from(dfsScores)
      .innerJoin(users, eq(users.id, dfsScores.user_id))
      .where(
        and(
          eq(dfsScores.sport, sport as any),
          eq(dfsScores.is_unlocked, true),
        )
      )
      .orderBy(desc(dfsScores.score))
      .limit(limit)
      .offset(offset);

    const leaderboard = scores.map((s, i) => ({
      rank: offset + i + 1,
      ...s,
      is_self: s.user_id === userId,
    }));

    let userPosition = leaderboard.find((l) => l.is_self);
    if (!userPosition) {
      const [userScore] = await db
        .select({ score: dfsScores.score, is_unlocked: dfsScores.is_unlocked })
        .from(dfsScores)
        .where(and(eq(dfsScores.user_id, userId), eq(dfsScores.sport, sport as any)))
        .limit(1);

      if (userScore && userScore.is_unlocked) {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(dfsScores)
          .where(
            and(
              eq(dfsScores.sport, sport as any),
              eq(dfsScores.is_unlocked, true),
              sql`${dfsScores.score} > ${userScore.score}`,
            )
          );

        userPosition = {
          rank: (countResult?.count || 0) + 1,
          user_id: userId,
          username: '',
          avatar_url: null,
          score: userScore.score,
          total_contests: 0,
          roi: null,
          cash_rate: null,
          is_self: true,
        } as any;
      }
    }

    res.json({ leaderboard, user_position: userPosition || null });
  } catch (err) {
    console.error('DFS national leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/leaderboards/:sport/friends', authMiddleware, requirePro, async (req: Request, res: Response): Promise<void> => {
  try {
    const sport = req.params.sport;
    const userId = req.user!.userId;

    const following = await db
      .select({ following_id: follows.following_id })
      .from(follows)
      .where(eq(follows.follower_id, userId));

    const friendIds = following.map((f) => f.following_id);
    friendIds.push(userId);

    const scores = await db
      .select({
        user_id: dfsScores.user_id,
        username: users.username,
        avatar_url: users.avatar_url,
        score: dfsScores.score,
        is_unlocked: dfsScores.is_unlocked,
        total_contests: dfsScores.total_contests,
        roi: dfsScores.roi,
        cash_rate: dfsScores.cash_rate,
      })
      .from(dfsScores)
      .innerJoin(users, eq(users.id, dfsScores.user_id))
      .where(
        and(
          inArray(dfsScores.user_id, friendIds),
          eq(dfsScores.sport, sport as any),
        )
      )
      .orderBy(desc(dfsScores.score));

    const unlocked = scores.filter((s) => s.is_unlocked);
    const locked = scores.filter((s) => !s.is_unlocked);

    const leaderboard = [
      ...unlocked.map((s, i) => ({
        rank: i + 1,
        ...s,
        is_self: s.user_id === userId,
      })),
      ...locked.map((s) => ({
        rank: null,
        ...s,
        is_self: s.user_id === userId,
        locked_label: `Locked — ${s.total_contests}/20 contests needed`,
      })),
    ];

    const userPosition = leaderboard.find((l) => l.is_self);
    res.json({ leaderboard, user_position: userPosition });
  } catch (err) {
    console.error('DFS friend leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DFS Badges ──────────────────────────────────────────────

router.get('/badges', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userBadges = await db
      .select()
      .from(dfsBadges)
      .where(eq(dfsBadges.user_id, req.user!.userId))
      .orderBy(desc(dfsBadges.earned_at));

    res.json({ badges: userBadges });
  } catch (err) {
    console.error('DFS badges error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Score History ───────────────────────────────────────────

router.get('/score-history', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const sport = (req.query.sport as string) || 'overall';
    const snapshots = await db
      .select({
        score: dfsScoreSnapshots.score,
        snapshot_date: dfsScoreSnapshots.snapshot_date,
      })
      .from(dfsScoreSnapshots)
      .where(
        and(
          eq(dfsScoreSnapshots.user_id, req.user!.userId),
          eq(dfsScoreSnapshots.sport, sport as any),
        )
      )
      .orderBy(dfsScoreSnapshots.snapshot_date);

    res.json({ snapshots });
  } catch (err) {
    console.error('DFS score history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── CSV Import ──────────────────────────────────────────────

router.post('/csv-import', authMiddleware, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const platform = req.body.platform as string;
    if (!['draftkings', 'fanduel', 'yahoo', 'underdog', 'prizepicks', 'other'].includes(platform)) {
      res.status(400).json({ error: 'Invalid platform' });
      return;
    }

    const csvText = req.file.buffer.toString('utf-8');
    const lines = csvText.split('\n').filter((l) => l.trim());

    if (lines.length < 2) {
      res.status(400).json({ error: 'CSV file is empty or has no data rows' });
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
    let rowsImported = 0;
    let rowsSkipped = 0;

    const contestValues: Array<{
      user_id: string;
      platform: any;
      sport: any;
      contest_type: any;
      contest_name: string | null;
      contest_id: string | null;
      entry_fee_cents: number;
      payout_cents: number;
      entries: number | null;
      finish_position: number | null;
      total_entries: number | null;
      points_scored: string | null;
      is_csv_import: boolean;
      contest_date: Date;
    }> = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const row = parseCSVRow(lines[i]);
        if (row.length < headers.length) {
          rowsSkipped++;
          continue;
        }

        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => { rowObj[h] = (row[idx] || '').trim(); });

        const parsed = parseDfsRow(rowObj, platform);
        if (!parsed) {
          rowsSkipped++;
          continue;
        }

        contestValues.push({
          user_id: req.user!.userId,
          platform: platform as any,
          sport: parsed.sport as any,
          contest_type: parsed.contest_type as any,
          contest_name: parsed.contest_name,
          contest_id: parsed.contest_id,
          entry_fee_cents: parsed.entry_fee_cents,
          payout_cents: parsed.payout_cents,
          entries: parsed.entries,
          finish_position: parsed.finish_position,
          total_entries: parsed.total_entries,
          points_scored: parsed.points_scored ? String(parsed.points_scored) : null,
          is_csv_import: true,
          contest_date: parsed.contest_date,
        });

        rowsImported++;
      } catch {
        rowsSkipped++;
      }
    }

    // Batch insert
    if (contestValues.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < contestValues.length; i += batchSize) {
        await db.insert(dfsContests).values(contestValues.slice(i, i + batchSize));
      }
    }

    // Log import
    await db.insert(dfsCsvImports).values({
      user_id: req.user!.userId,
      platform: platform as any,
      file_name: req.file.originalname || 'upload.csv',
      rows_imported: rowsImported,
      rows_skipped: rowsSkipped,
    });

    // Recalculate DFS score and check badges
    await calculateDfsScore(req.user!.userId);
    const newBadges = await checkAndAwardDfsBadges(req.user!.userId);

    res.json({
      message: `Imported ${rowsImported} contests, skipped ${rowsSkipped} rows`,
      rows_imported: rowsImported,
      rows_skipped: rowsSkipped,
      newBadges,
    });
  } catch (err) {
    console.error('DFS CSV import error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── CSV Parsing Helpers ─────────────────────────────────────

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

interface ParsedDfsRow {
  sport: string;
  contest_type: string;
  contest_name: string | null;
  contest_id: string | null;
  entry_fee_cents: number;
  payout_cents: number;
  entries: number | null;
  finish_position: number | null;
  total_entries: number | null;
  points_scored: number | null;
  contest_date: Date;
}

function parseDfsRow(row: Record<string, string>, platform: string): ParsedDfsRow | null {
  if (platform === 'draftkings') return parseDraftKingsRow(row);
  if (platform === 'fanduel') return parseFanDuelRow(row);
  return parseGenericRow(row);
}

function parseDraftKingsRow(row: Record<string, string>): ParsedDfsRow | null {
  // DraftKings CSV columns: Contest_Key, Sport, Date, Contest, Entry_Key, Entry_Fee, Winnings, Points, Position, Entries
  const entryFee = parseFloat(row['entry_fee'] || row['entry fee'] || row['entryfee'] || '0');
  const winnings = parseFloat(row['winnings'] || row['payout'] || row['prize'] || '0');
  const dateStr = row['date'] || row['contest_date'] || row['contest date'] || '';
  const sport = mapSport(row['sport'] || row['game_type'] || row['game type'] || '');
  const contestType = mapContestType(row['contest'] || row['contest_name'] || row['contest name'] || '', entryFee);

  if (!dateStr || isNaN(entryFee)) return null;

  const contestDate = new Date(dateStr);
  if (isNaN(contestDate.getTime())) return null;

  return {
    sport,
    contest_type: contestType,
    contest_name: row['contest'] || row['contest_name'] || row['contest name'] || null,
    contest_id: row['contest_key'] || row['contest key'] || row['contestkey'] || null,
    entry_fee_cents: Math.round(entryFee * 100),
    payout_cents: Math.round(winnings * 100),
    entries: parseInt(row['entries'] || '0') || null,
    finish_position: parseInt(row['position'] || row['place'] || '0') || null,
    total_entries: parseInt(row['entries'] || row['total_entries'] || '0') || null,
    points_scored: parseFloat(row['points'] || row['fpts'] || '0') || null,
    contest_date: contestDate,
  };
}

function parseFanDuelRow(row: Record<string, string>): ParsedDfsRow | null {
  // FanDuel CSV: Date, Sport, Title, Entry ($), Winnings ($), Points, Position, Entries
  const entryFee = parseFloat((row['entry ($)'] || row['entry'] || row['entry_fee'] || row['fee'] || '0').replace('$', ''));
  const winnings = parseFloat((row['winnings ($)'] || row['winnings'] || row['payout'] || '0').replace('$', ''));
  const dateStr = row['date'] || '';
  const sport = mapSport(row['sport'] || '');
  const contestType = mapContestType(row['title'] || row['contest'] || '', entryFee);

  if (!dateStr || isNaN(entryFee)) return null;

  const contestDate = new Date(dateStr);
  if (isNaN(contestDate.getTime())) return null;

  return {
    sport,
    contest_type: contestType,
    contest_name: row['title'] || row['contest'] || null,
    contest_id: row['contest_id'] || null,
    entry_fee_cents: Math.round(entryFee * 100),
    payout_cents: Math.round(winnings * 100),
    entries: parseInt(row['entries'] || '0') || null,
    finish_position: parseInt(row['position'] || row['place'] || '0') || null,
    total_entries: parseInt(row['entries'] || '0') || null,
    points_scored: parseFloat(row['points'] || row['fpts'] || '0') || null,
    contest_date: contestDate,
  };
}

function parseGenericRow(row: Record<string, string>): ParsedDfsRow | null {
  const entryFee = parseFloat(row['entry_fee'] || row['entry fee'] || row['fee'] || row['buyin'] || row['buy_in'] || '0');
  const payout = parseFloat(row['payout'] || row['winnings'] || row['prize'] || '0');
  const dateStr = row['date'] || row['contest_date'] || '';

  if (!dateStr || isNaN(entryFee)) return null;

  const contestDate = new Date(dateStr);
  if (isNaN(contestDate.getTime())) return null;

  return {
    sport: mapSport(row['sport'] || 'other'),
    contest_type: mapContestType(row['contest_type'] || row['type'] || '', entryFee),
    contest_name: row['contest_name'] || row['contest'] || row['title'] || null,
    contest_id: row['contest_id'] || row['id'] || null,
    entry_fee_cents: Math.round(entryFee * 100),
    payout_cents: Math.round(payout * 100),
    entries: parseInt(row['entries'] || '0') || null,
    finish_position: parseInt(row['position'] || row['place'] || row['finish'] || '0') || null,
    total_entries: parseInt(row['total_entries'] || row['entries'] || '0') || null,
    points_scored: parseFloat(row['points'] || row['fpts'] || '0') || null,
    contest_date: contestDate,
  };
}

function mapSport(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s.includes('nfl') || s.includes('football')) return 'nfl';
  if (s.includes('nba') || s.includes('basketball')) return 'nba';
  if (s.includes('mlb') || s.includes('baseball')) return 'mlb';
  if (s.includes('nhl') || s.includes('hockey')) return 'nhl';
  if (s.includes('pga') || s.includes('golf')) return 'pga';
  if (s.includes('nascar') || s.includes('racing')) return 'nascar';
  if (s.includes('soccer') || s.includes('epl') || s.includes('mls')) return 'soccer';
  if (s.includes('mma') || s.includes('ufc')) return 'mma';
  if (s.includes('cfb') || s.includes('college football') || s.includes('ncaaf')) return 'cfb';
  if (s.includes('cbb') || s.includes('college basketball') || s.includes('ncaab')) return 'cbb';
  return 'nfl';
}

function mapContestType(name: string, entryFee: number): string {
  const n = name.toLowerCase();
  if (n.includes('double up') || n.includes('50/50') || n.includes('fifty')) return 'fifty_fifty';
  if (n.includes('h2h') || n.includes('head')) return 'h2h';
  if (n.includes('gpp') || n.includes('tournament') || n.includes('milly') || n.includes('million')) return 'gpp';
  if (n.includes('multiplier') || n.includes('3x') || n.includes('5x') || n.includes('10x')) return 'multiplier';
  if (n.includes('satellite') || n.includes('qualifier')) return 'satellite';
  if (n.includes('cash') || n.includes('single')) return 'cash';
  if (entryFee > 0) return 'cash';
  return 'other';
}

export default router;
