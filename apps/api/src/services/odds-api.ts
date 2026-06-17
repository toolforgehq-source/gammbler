import axios from 'axios';
import { env } from '../config/env';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

interface OddsResponse {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number;
        point?: number;
      }>;
    }>;
  }>;
}

export async function getClosingOdds(
  sportKey: string,
  eventId: string
): Promise<Record<string, number> | null> {
  if (!env.ODDS_API_KEY) return null;

  try {
    const response = await axios.get(
      `${ODDS_API_BASE}/sports/${sportKey}/odds`,
      {
        params: {
          apiKey: env.ODDS_API_KEY,
          regions: 'us',
          markets: 'h2h,spreads,totals',
          oddsFormat: 'american',
        },
      }
    );

    const events: OddsResponse[] = response.data;
    const event = events.find((e) => e.id === eventId);
    if (!event) return null;

    // Average closing odds across bookmakers for each outcome
    const closingOdds: Record<string, number[]> = {};
    for (const bookmaker of event.bookmakers) {
      for (const market of bookmaker.markets) {
        for (const outcome of market.outcomes) {
          const key = `${market.key}_${outcome.name}`;
          if (!closingOdds[key]) closingOdds[key] = [];
          closingOdds[key].push(outcome.price);
        }
      }
    }

    const averaged: Record<string, number> = {};
    for (const [key, prices] of Object.entries(closingOdds)) {
      averaged[key] = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
    }

    return averaged;
  } catch (err) {
    console.error('Odds API error:', err);
    return null;
  }
}

export async function getLiveOdds(sportKey: string): Promise<OddsResponse[]> {
  if (!env.ODDS_API_KEY) return [];

  try {
    const response = await axios.get(
      `${ODDS_API_BASE}/sports/${sportKey}/odds`,
      {
        params: {
          apiKey: env.ODDS_API_KEY,
          regions: 'us',
          markets: 'h2h,spreads,totals',
          oddsFormat: 'american',
        },
      }
    );

    return response.data;
  } catch (err) {
    console.error('Odds API live error:', err);
    return [];
  }
}

export function mapSportToOddsApiKey(sport: string): string {
  const mapping: Record<string, string> = {
    nfl: 'americanfootball_nfl',
    nba: 'basketball_nba',
    mlb: 'baseball_mlb',
    nhl: 'icehockey_nhl',
    cfb: 'americanfootball_ncaaf',
    cbb: 'basketball_ncaab',
    soccer: 'soccer_usa_mls',
  };
  return mapping[sport] || sport;
}

// Multiple soccer leagues to search for active games
const SOCCER_LEAGUE_KEYS = [
  'soccer_usa_mls',
  'soccer_epl',
  'soccer_spain_la_liga',
  'soccer_germany_bundesliga',
  'soccer_italy_serie_a',
  'soccer_france_ligue_one',
  'soccer_fifa_world_cup',
  'soccer_uefa_champs_league',
  'soccer_mexico_ligamx',
  'soccer_brazil_campeonato',
  'soccer_conmebol_copa_libertadores',
];

export async function getActiveSports(): Promise<Array<{ sport: string; gameCount: number }>> {
  if (!env.ODDS_API_KEY) return [];

  try {
    const response = await axios.get(`${ODDS_API_BASE}/sports`, {
      params: { apiKey: env.ODDS_API_KEY },
      timeout: 10000,
    });

    const activeSports: Array<{ key: string; active: boolean; has_outrights: boolean }> = response.data;
    const sportMapping: Record<string, string[]> = {
      nfl: ['americanfootball_nfl'],
      nba: ['basketball_nba'],
      mlb: ['baseball_mlb'],
      nhl: ['icehockey_nhl'],
      cfb: ['americanfootball_ncaaf'],
      cbb: ['basketball_ncaab'],
      soccer: SOCCER_LEAGUE_KEYS,
    };

    const results: Array<{ sport: string; gameCount: number }> = [];

    for (const [sport, keys] of Object.entries(sportMapping)) {
      // Check if any of the API keys for this sport are active (non-outrights)
      const hasActive = keys.some(k =>
        activeSports.some(s => s.key === k && s.active && !s.has_outrights)
      );
      if (hasActive) {
        // Fetch count for first active key
        try {
          const key = keys.find(k =>
            activeSports.some(s => s.key === k && s.active && !s.has_outrights)
          ) || keys[0];
          const oddsRes = await axios.get(`${ODDS_API_BASE}/sports/${key}/odds`, {
            params: {
              apiKey: env.ODDS_API_KEY,
              regions: 'us',
              markets: 'h2h',
              oddsFormat: 'american',
            },
            timeout: 10000,
          });
          const gameCount = Array.isArray(oddsRes.data) ? oddsRes.data.length : 0;
          results.push({ sport, gameCount });
        } catch {
          results.push({ sport, gameCount: 0 });
        }
      } else {
        results.push({ sport, gameCount: 0 });
      }
    }

    return results;
  } catch (err) {
    console.error('Active sports fetch error:', err);
    return [];
  }
}

export async function getLiveOddsMultiLeague(sport: string): Promise<OddsResponse[]> {
  if (!env.ODDS_API_KEY) return [];

  // For soccer, try multiple leagues
  if (sport === 'soccer') {
    for (const leagueKey of SOCCER_LEAGUE_KEYS) {
      try {
        const response = await axios.get(`${ODDS_API_BASE}/sports/${leagueKey}/odds`, {
          params: {
            apiKey: env.ODDS_API_KEY,
            regions: 'us',
            markets: 'h2h,spreads,totals',
            oddsFormat: 'american',
          },
          timeout: 10000,
        });
        if (Array.isArray(response.data) && response.data.length > 0) {
          console.log(`[Odds API] Soccer: found ${response.data.length} games from ${leagueKey}`);
          return response.data;
        }
      } catch {
        continue;
      }
    }
    console.log('[Odds API] Soccer: no games found across all leagues');
    return [];
  }

  return getLiveOdds(mapSportToOddsApiKey(sport));
}

export async function validateBetAgainstOdds(
  sport: string,
  eventName: string | undefined,
  selection: string,
  odds: number,
  betType: string,
): Promise<{ validated: boolean; matchedEventId?: string; reason?: string }> {
  try {
    const events = await getLiveOddsMultiLeague(sport);
    if (events.length === 0) {
      return { validated: false, reason: 'no_events_available' };
    }

    // Find matching event by team names — score each event and pick the best match
    // to avoid city-name collisions (e.g., "Los Angeles" matching Dodgers instead of Angels)
    const searchText = `${selection} ${eventName || ''}`.toLowerCase();
    let matchedEvent: OddsResponse | undefined;
    let bestScore = 0;

    for (const event of events) {
      const home = event.home_team.toLowerCase();
      const away = event.away_team.toLowerCase();
      let score = 0;

      // Full team name match = strongest signal (4 points)
      if (searchText.includes(home)) score += 4;
      if (searchText.includes(away)) score += 4;

      // Partial word match = weaker signal (1 point per matching word)
      if (score === 0) {
        for (const w of home.split(' ')) {
          if (w.length > 3 && searchText.includes(w)) score += 1;
        }
        for (const w of away.split(' ')) {
          if (w.length > 3 && searchText.includes(w)) score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        matchedEvent = event;
      }
    }

    if (!matchedEvent) {
      return { validated: false, reason: 'event_not_found' };
    }

    // Tolerance: odds within 30 for normal range, percentage-based for extreme odds
    function oddsWithinTolerance(userOdds: number, realOdds: number): boolean {
      const absDiff = Math.abs(userOdds - realOdds);
      // For extreme odds (>1000 or <-1000), use 10% tolerance
      if (Math.abs(realOdds) > 1000) {
        return absDiff <= Math.abs(realOdds) * 0.10;
      }
      return absDiff <= 30;
    }

    // Extract line/point from selection text (e.g., "Patriots -3.5" → -3.5, "Over 45.5" → 45.5)
    const selLower = selection.toLowerCase();
    const pointMatch = selLower.match(/([+-]?\d+\.?\d*)\s*$/);
    const userPoint = pointMatch ? parseFloat(pointMatch[1]) : undefined;
    const POINT_TOLERANCE = 1.5;

    // Also extract team/side name from selection
    const selectionTeam = selection.replace(/[+-]?\d+\.?\d*\s*$/, '').trim().toLowerCase();

    const marketKeyMap: Record<string, string> = {
      moneyline: 'h2h', spread: 'spreads', over_under: 'totals',
    };
    const marketKey = marketKeyMap[betType] || 'h2h';

    let validated = false;
    for (const bookmaker of matchedEvent.bookmakers) {
      for (const market of bookmaker.markets) {
        if (market.key !== marketKey && marketKeyMap[betType]) continue;

        for (const outcome of market.outcomes) {
          // Check outcome name matches the selection side
          const outcomeName = outcome.name.toLowerCase();
          let nameMatch = true;
          if (selectionTeam) {
            nameMatch = outcomeName.includes(selectionTeam) ||
              selectionTeam.includes(outcomeName) ||
              outcomeName.split(' ').some(w => w.length > 3 && selectionTeam.includes(w)) ||
              selectionTeam.split(' ').some(w => w.length > 3 && outcomeName.includes(w));
          }

          if (!nameMatch) continue;

          // Check odds
          if (!oddsWithinTolerance(odds, outcome.price)) continue;

          // Check point/line for spreads and totals
          if (marketKey === 'spreads' || marketKey === 'totals') {
            if (outcome.point !== undefined && userPoint !== undefined) {
              if (Math.abs(outcome.point - userPoint) > POINT_TOLERANCE) continue;
            }
          }

          validated = true;
          break;
        }
        if (validated) break;
      }
      if (validated) break;
    }

    if (!validated) {
      return { validated: false, matchedEventId: matchedEvent.id, reason: 'odds_mismatch' };
    }

    return { validated: true, matchedEventId: matchedEvent.id };
  } catch (err) {
    console.error('Bet validation error:', err);
    return { validated: false, reason: 'validation_error' };
  }
}
