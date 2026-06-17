import axios from 'axios';
import { db } from '../db';
import { bets, sportsbookConnections } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { env } from '../config/env';
import { updateAllScores } from './gammbler-score';
import { checkAndAwardBadges } from './badges';
import { createFeedEvent } from './feed';

const SHARPSPORTS_BASE = 'https://api.sharpsports.io/v1';

interface SharpSportsBet {
  id: string;
  book: string;
  sport: string;
  league: string;
  type: string;
  description: string;
  odds: number;
  risk: number;
  win_amount: number;
  result: 'win' | 'loss' | 'push' | 'pending' | 'cashout';
  placed_at: string;
  settled_at: string | null;
  legs?: number;
}

function getHeaders() {
  return {
    Authorization: `Token ${env.SHARPSPORTS_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export async function initiateConnection(userId: string, platform: string): Promise<{ url: string }> {
  if (!env.SHARPSPORTS_API_KEY) {
    throw new Error('SharpSports not configured');
  }

  const response = await axios.post(
    `${SHARPSPORTS_BASE}/context/`,
    {
      book: platform,
      callback_url: `${env.FRONTEND_URL}/settings/connections?status=connected`,
    },
    { headers: getHeaders() }
  );

  return { url: response.data.url };
}

export async function completeConnection(
  userId: string,
  platform: string,
  sharpsportsAccountId: string
): Promise<void> {
  await db
    .insert(sportsbookConnections)
    .values({
      user_id: userId,
      platform: platform as any,
      sharpsports_account_id: sharpsportsAccountId,
    })
    .onConflictDoUpdate({
      target: [sportsbookConnections.user_id, sportsbookConnections.platform],
      set: {
        sharpsports_account_id: sharpsportsAccountId,
        connected_at: new Date(),
      },
    });

  await createFeedEvent(userId, 'sportsbook_connected', { platform });
}

export async function syncBets(userId: string, platform: string): Promise<number> {
  if (!env.SHARPSPORTS_API_KEY) {
    return 0;
  }

  const [connection] = await db
    .select()
    .from(sportsbookConnections)
    .where(
      and(
        eq(sportsbookConnections.user_id, userId),
        eq(sportsbookConnections.platform, platform as any)
      )
    )
    .limit(1);

  if (!connection || !connection.sharpsports_account_id) {
    return 0;
  }

  try {
    const response = await axios.get(
      `${SHARPSPORTS_BASE}/bettors/${connection.sharpsports_account_id}/bets/`,
      { headers: getHeaders() }
    );

    const remoteBets: SharpSportsBet[] = response.data.results || [];
    let imported = 0;

    for (const remoteBet of remoteBets) {
      // Check if already imported
      const existing = await db
        .select()
        .from(bets)
        .where(eq(bets.sharpsports_bet_id, remoteBet.id))
        .limit(1);

      if (existing.length > 0) {
        // Update result if changed
        if (existing[0].result === 'pending' && remoteBet.result !== 'pending') {
          const profitLoss = remoteBet.result === 'win'
            ? remoteBet.win_amount
            : remoteBet.result === 'loss'
              ? -remoteBet.risk
              : 0;

          await db
            .update(bets)
            .set({
              result: mapResult(remoteBet.result) as any,
              profit_loss: String(profitLoss),
              settled_at: remoteBet.settled_at ? new Date(remoteBet.settled_at) : new Date(),
            })
            .where(eq(bets.id, existing[0].id));
        }
        continue;
      }

      const sport = mapSport(remoteBet.sport, remoteBet.league);
      const betType = mapBetType(remoteBet.type);
      const result = mapResult(remoteBet.result);
      const profitLoss = result === 'win'
        ? remoteBet.win_amount
        : result === 'loss'
          ? -remoteBet.risk
          : 0;

      await db.insert(bets).values({
        user_id: userId,
        platform: platform as any,
        sport: sport as any,
        league: remoteBet.league,
        bet_type: betType as any,
        selection: remoteBet.description,
        odds: String(remoteBet.odds),
        stake: String(remoteBet.risk),
        result: mapResult(remoteBet.result) as any,
        profit_loss: String(profitLoss),
        settled_at: remoteBet.settled_at ? new Date(remoteBet.settled_at) : null,
        created_at: new Date(remoteBet.placed_at),
        is_manual: false,
        sharpsports_bet_id: remoteBet.id,
        parlay_legs: remoteBet.legs,
        trust_status: 'synced_verified',
        validation_reason: 'sharpsports_sync',
      } as typeof bets.$inferInsert);

      imported++;
    }

    // Update sync timestamp
    await db
      .update(sportsbookConnections)
      .set({ last_synced_at: new Date() })
      .where(eq(sportsbookConnections.id, connection.id));

    // Recalculate scores
    if (imported > 0) {
      await updateAllScores(userId);
      await checkAndAwardBadges(userId);
    }

    return imported;
  } catch (err) {
    console.error(`SharpSports sync error for ${platform}:`, err);
    return 0;
  }
}

function mapSport(sport: string, league: string): string {
  const s = (sport + ' ' + league).toLowerCase();
  if (s.includes('football') && s.includes('ncaa')) return 'cfb';
  if (s.includes('football') || s.includes('nfl')) return 'nfl';
  if (s.includes('basketball') && s.includes('ncaa')) return 'cbb';
  if (s.includes('basketball') || s.includes('nba')) return 'nba';
  if (s.includes('baseball') || s.includes('mlb')) return 'mlb';
  if (s.includes('hockey') || s.includes('nhl')) return 'nhl';
  if (s.includes('soccer') || s.includes('mls') || s.includes('premier')) return 'soccer';
  return 'nfl';
}

function mapBetType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('spread')) return 'spread';
  if (t.includes('moneyline') || t.includes('ml')) return 'moneyline';
  if (t.includes('total') || t.includes('over') || t.includes('under')) return 'over_under';
  if (t.includes('parlay')) return 'parlay';
  if (t.includes('player')) return 'player_prop';
  if (t.includes('prop')) return 'prop';
  if (t.includes('teaser')) return 'teaser';
  if (t.includes('future')) return 'futures';
  return 'other';
}

function mapResult(result: string): string {
  if (result === 'cashout') return 'win';
  if (['win', 'loss', 'push', 'pending'].includes(result)) return result;
  return 'pending';
}
