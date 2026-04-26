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
