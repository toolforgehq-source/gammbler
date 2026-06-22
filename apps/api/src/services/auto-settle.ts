import axios from 'axios';
import { db } from '../db';
import { bets, users, betSlips } from '../db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { env } from '../config/env';
import { mapSportToOddsApiKey } from './odds-api';
import { updateAllScores } from './gammbler-score';
import { checkAndAwardBadges } from './badges';
import { createFeedEvent } from './feed';
import { sendBetSettledEmail } from './email';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

interface ScoreEntry {
  name: string;
  score: string;
}

interface GameScore {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: ScoreEntry[] | null;
  last_updated: string | null;
}

// Cache: sportKey -> { scores, fetchedAt }
const scoresCache: Map<string, { scores: GameScore[]; fetchedAt: number }> = new Map();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

async function fetchScores(sportKey: string): Promise<GameScore[]> {
  const cached = scoresCache.get(sportKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.scores;
  }

  if (!env.ODDS_API_KEY) {
    console.warn('[Auto-Settle] No ODDS_API_KEY configured');
    return [];
  }

  try {
    const response = await axios.get(
      `${ODDS_API_BASE}/sports/${sportKey}/scores`,
      {
        params: {
          apiKey: env.ODDS_API_KEY,
          daysFrom: 3,
        },
        timeout: 15000,
      }
    );

    const scores: GameScore[] = response.data;
    scoresCache.set(sportKey, { scores, fetchedAt: Date.now() });
    return scores;
  } catch (err) {
    console.error(`[Auto-Settle] Scores fetch error for ${sportKey}:`, err);
    return cached?.scores || [];
  }
}

function determineBetResult(
  betType: string,
  selection: string,
  game: GameScore
): 'win' | 'loss' | 'push' | null {
  if (!game.completed || !game.scores || game.scores.length < 2) return null;

  const homeEntry = game.scores.find(s => s.name === game.home_team);
  const awayEntry = game.scores.find(s => s.name === game.away_team);
  if (!homeEntry || !awayEntry) return null;

  const homeScore = parseFloat(homeEntry.score);
  const awayScore = parseFloat(awayEntry.score);
  if (isNaN(homeScore) || isNaN(awayScore)) return null;

  if (betType === 'moneyline') {
    // Selection is the team name, e.g. "Kansas City Chiefs"
    const isHome = normalizeTeam(selection) === normalizeTeam(game.home_team);
    const isAway = normalizeTeam(selection) === normalizeTeam(game.away_team);

    if (!isHome && !isAway) {
      // Fuzzy match — check if selection contains the team name or vice versa
      const selLower = selection.toLowerCase();
      const homeMatches = selLower.includes(game.home_team.toLowerCase()) ||
        game.home_team.toLowerCase().includes(selLower);
      const awayMatches = selLower.includes(game.away_team.toLowerCase()) ||
        game.away_team.toLowerCase().includes(selLower);

      if (homeMatches) {
        return homeScore > awayScore ? 'win' : homeScore < awayScore ? 'loss' : 'push';
      }
      if (awayMatches) {
        return awayScore > homeScore ? 'win' : awayScore < homeScore ? 'loss' : 'push';
      }
      return null;
    }

    const selectedScore = isHome ? homeScore : awayScore;
    const opponentScore = isHome ? awayScore : homeScore;

    if (selectedScore > opponentScore) return 'win';
    if (selectedScore < opponentScore) return 'loss';
    return 'push';
  }

  if (betType === 'spread') {
    // Selection like "Kansas City Chiefs -3.5" or "Denver Broncos +3.5"
    const spreadMatch = selection.match(/^(.+?)\s+([+-]?\d+(?:\.\d+)?)$/);
    if (!spreadMatch) return null;

    const teamName = spreadMatch[1].trim();
    const spread = parseFloat(spreadMatch[2]);
    if (isNaN(spread)) return null;

    const isHome = teamMatchesGame(teamName, game.home_team);
    const isAway = teamMatchesGame(teamName, game.away_team);
    if (!isHome && !isAway) return null;

    const selectedScore = isHome ? homeScore : awayScore;
    const opponentScore = isHome ? awayScore : homeScore;

    const adjustedScore = selectedScore + spread;
    if (adjustedScore > opponentScore) return 'win';
    if (adjustedScore < opponentScore) return 'loss';
    return 'push';
  }

  if (betType === 'over_under') {
    // Selection like "Over 45.5" or "Under 45.5"
    const totalMatch = selection.match(/^(Over|Under)\s+(\d+(?:\.\d+)?)$/i);
    if (!totalMatch) return null;

    const side = totalMatch[1].toLowerCase();
    const line = parseFloat(totalMatch[2]);
    if (isNaN(line)) return null;

    const actualTotal = homeScore + awayScore;

    if (side === 'over') {
      if (actualTotal > line) return 'win';
      if (actualTotal < line) return 'loss';
      return 'push';
    } else {
      if (actualTotal < line) return 'win';
      if (actualTotal > line) return 'loss';
      return 'push';
    }
  }

  // Can't auto-settle other bet types (parlay, prop, futures, etc.)
  return null;
}

function normalizeTeam(name: string): string {
  return name.toLowerCase().trim();
}

function teamMatchesGame(selectedTeam: string, gameTeam: string): boolean {
  const sel = selectedTeam.toLowerCase().trim();
  const game = gameTeam.toLowerCase().trim();
  if (sel === game) return true;
  // Check if one contains the other (handles partial names)
  if (sel.includes(game) || game.includes(sel)) return true;
  // Check last word (mascot) match
  const selWords = sel.split(' ');
  const gameWords = game.split(' ');
  if (selWords[selWords.length - 1] === gameWords[gameWords.length - 1]) return true;
  return false;
}

function calculatePayout(americanOdds: number, stake: number): number {
  if (americanOdds > 0) {
    return stake + (stake * americanOdds) / 100;
  }
  return stake + (stake * 100) / Math.abs(americanOdds);
}

// Map internal sport names to Odds API sport keys
const SETTLEABLE_SPORTS = ['nfl', 'nba', 'mlb', 'nhl', 'cfb', 'cbb', 'soccer'];

export async function settlePendingBets(): Promise<{
  settled: number;
  errors: number;
  checked: number;
}> {
  let settled = 0;
  let errors = 0;
  let checked = 0;

  try {
    // Get all pending bets that are tied to a real game (have odds_api_event_id)
    const pendingBets = await db
      .select()
      .from(bets)
      .where(
        and(
          eq(bets.result, 'pending'),
          isNotNull(bets.odds_api_event_id)
        )
      );

    if (pendingBets.length === 0) {
      return { settled: 0, errors: 0, checked: 0 };
    }

    checked = pendingBets.length;
    console.log(`[Auto-Settle] Checking ${pendingBets.length} pending bets`);

    // Group bets by sport
    const betsBySport: Record<string, typeof pendingBets> = {};
    for (const bet of pendingBets) {
      if (!betsBySport[bet.sport]) betsBySport[bet.sport] = [];
      betsBySport[bet.sport].push(bet);
    }

    // For each sport, fetch scores and settle matching bets
    for (const [sport, sportBets] of Object.entries(betsBySport)) {
      if (!SETTLEABLE_SPORTS.includes(sport)) continue;

      const sportKey = mapSportToOddsApiKey(sport);
      const scores = await fetchScores(sportKey);

      // Build lookup: event ID -> game score
      const scoreMap = new Map<string, GameScore>();
      for (const game of scores) {
        scoreMap.set(game.id, game);
      }

      for (const bet of sportBets) {
        try {
          const game = scoreMap.get(bet.odds_api_event_id!);
          if (!game || !game.completed) continue;

          const result = determineBetResult(bet.bet_type, bet.selection, game);
          if (!result) continue;

          const stake = parseFloat(String(bet.stake));
          const odds = parseFloat(String(bet.odds));
          const profitLoss = result === 'win'
            ? calculatePayout(odds, stake) - stake
            : result === 'loss'
              ? -stake
              : 0;

          // Settle the bet
          await db
            .update(bets)
            .set({
              result,
              profit_loss: String(profitLoss),
              settled_at: new Date(),
            })
            .where(eq(bets.id, bet.id));

          // Update scores and badges
          await updateAllScores(bet.user_id);
          await checkAndAwardBadges(bet.user_id);

          // Parlay hit feed event
          if (result === 'win' && bet.bet_type === 'parlay' && bet.parlay_legs && bet.parlay_legs >= 3) {
            await createFeedEvent(bet.user_id, 'parlay_hit', {
              legs: bet.parlay_legs,
              payout: profitLoss + stake,
            }, bet.sport);
          }

          // Send email notification (fire & forget)
          const [betUser] = await db
            .select({ email: users.email, username: users.username })
            .from(users)
            .where(eq(users.id, bet.user_id))
            .limit(1);

          if (betUser) {
            const plStr = profitLoss >= 0
              ? `+$${profitLoss.toFixed(2)}`
              : `-$${Math.abs(profitLoss).toFixed(2)}`;
            sendBetSettledEmail(
              betUser.email,
              betUser.username,
              bet.selection,
              result,
              plStr
            ).catch(() => {});
          }

          // Auto-settle any linked bet slips
          const slipStatus = result === 'win' ? 'won' : result === 'loss' ? 'lost' : result === 'push' ? 'pushed' : 'void';
          await db
            .update(betSlips)
            .set({
              status: slipStatus as typeof betSlips.$inferInsert.status,
              profit_loss: String(profitLoss),
              settled_at: new Date(),
            })
            .where(
              and(
                eq(betSlips.bet_id, bet.id),
                eq(betSlips.status, 'live')
              )
            );

          settled++;
          console.log(`[Auto-Settle] Settled bet ${bet.id}: ${bet.selection} → ${result}`);
        } catch (err) {
          errors++;
          console.error(`[Auto-Settle] Error settling bet ${bet.id}:`, err);
        }
      }
    }

    console.log(`[Auto-Settle] Done: ${settled} settled, ${errors} errors, ${checked} checked`);
  } catch (err) {
    console.error('[Auto-Settle] Fatal error:', err);
  }

  return { settled, errors, checked };
}
