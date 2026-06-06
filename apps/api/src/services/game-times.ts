import axios from 'axios';
import { env } from '../config/env';
import { mapSportToOddsApiKey } from './odds-api';

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

interface UpcomingEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

// Cache: sportKey -> { events, fetchedAt }
const eventCache: Map<string, { events: UpcomingEvent[]; fetchedAt: number }> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch upcoming events for a sport from The Odds API.
 * Results are cached for 5 minutes to minimize API calls.
 */
async function fetchUpcomingEvents(sportKey: string): Promise<UpcomingEvent[]> {
  const oddsKey = mapSportToOddsApiKey(sportKey);

  // Check cache
  const cached = eventCache.get(oddsKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.events;
  }

  if (!env.ODDS_API_KEY) {
    return [];
  }

  try {
    const response = await axios.get(
      `${ODDS_API_BASE}/sports/${oddsKey}/events`,
      {
        params: {
          apiKey: env.ODDS_API_KEY,
        },
        timeout: 10000,
      }
    );

    const events: UpcomingEvent[] = response.data;
    eventCache.set(oddsKey, { events, fetchedAt: Date.now() });
    return events;
  } catch (err) {
    console.error(`Game times fetch error for ${oddsKey}:`, err);
    // Return cached data even if stale on error
    return cached?.events || [];
  }
}

/**
 * Find the best matching event for a bet based on team names / event description.
 * Returns the event with commence_time if found, null otherwise.
 */
export async function findMatchingEvent(
  sport: string,
  selection: string,
  eventName?: string,
): Promise<{ eventId: string; commenceTime: Date; matchedEvent: string } | null> {
  // PrizePicks and DFS don't have traditional game times
  if (sport === 'prizepicks' || sport === 'dfs') {
    return null;
  }

  const events = await fetchUpcomingEvents(sport);
  if (events.length === 0) return null;

  const searchText = `${selection} ${eventName || ''}`.toLowerCase();

  // Try exact team matching first
  for (const event of events) {
    const home = event.home_team.toLowerCase();
    const away = event.away_team.toLowerCase();

    // Check if both teams appear, or one team is in the selection
    if (
      (searchText.includes(home) || searchText.includes(away)) ||
      matchTeamAbbreviation(searchText, event.home_team) ||
      matchTeamAbbreviation(searchText, event.away_team)
    ) {
      return {
        eventId: event.id,
        commenceTime: new Date(event.commence_time),
        matchedEvent: `${event.away_team} @ ${event.home_team}`,
      };
    }
  }

  // Fuzzy matching: try partial team name matches
  for (const event of events) {
    const homeWords = event.home_team.toLowerCase().split(' ');
    const awayWords = event.away_team.toLowerCase().split(' ');

    // Match on last word of team name (usually the mascot: "Chiefs", "Lakers", etc.)
    const homeMascot = homeWords[homeWords.length - 1];
    const awayMascot = awayWords[awayWords.length - 1];

    if (searchText.includes(homeMascot) || searchText.includes(awayMascot)) {
      return {
        eventId: event.id,
        commenceTime: new Date(event.commence_time),
        matchedEvent: `${event.away_team} @ ${event.home_team}`,
      };
    }
  }

  return null;
}

/**
 * Match common US sports abbreviations to full team names.
 */
function matchTeamAbbreviation(searchText: string, teamName: string): boolean {
  const abbreviations: Record<string, string[]> = {
    // NFL
    'arizona cardinals': ['ari', 'cards'],
    'atlanta falcons': ['atl'],
    'baltimore ravens': ['bal', 'balt'],
    'buffalo bills': ['buf'],
    'carolina panthers': ['car'],
    'chicago bears': ['chi'],
    'cincinnati bengals': ['cin', 'cincy'],
    'cleveland browns': ['cle'],
    'dallas cowboys': ['dal'],
    'denver broncos': ['den'],
    'detroit lions': ['det'],
    'green bay packers': ['gb'],
    'houston texans': ['hou'],
    'indianapolis colts': ['ind'],
    'jacksonville jaguars': ['jax'],
    'kansas city chiefs': ['kc'],
    'las vegas raiders': ['lv', 'lvr'],
    'los angeles chargers': ['lac'],
    'los angeles rams': ['lar'],
    'miami dolphins': ['mia'],
    'minnesota vikings': ['min'],
    'new england patriots': ['ne', 'nep'],
    'new orleans saints': ['no', 'nos'],
    'new york giants': ['nyg'],
    'new york jets': ['nyj'],
    'philadelphia eagles': ['phi', 'philly'],
    'pittsburgh steelers': ['pit'],
    'san francisco 49ers': ['sf', 'niners'],
    'seattle seahawks': ['sea'],
    'tampa bay buccaneers': ['tb', 'bucs'],
    'tennessee titans': ['ten'],
    'washington commanders': ['was', 'wsh'],
    // NBA
    'los angeles lakers': ['lal'],
    'los angeles clippers': ['lac'],
    'golden state warriors': ['gsw', 'warriors'],
    'boston celtics': ['bos'],
    'milwaukee bucks': ['mil'],
    'phoenix suns': ['phx'],
    'denver nuggets': ['den'],
    'dallas mavericks': ['dal', 'mavs'],
  };

  const teamLower = teamName.toLowerCase();
  const abbrs = abbreviations[teamLower];
  if (!abbrs) return false;

  return abbrs.some(abbr => {
    // Match abbreviation as a standalone word
    const regex = new RegExp(`\\b${abbr}\\b`, 'i');
    return regex.test(searchText);
  });
}

/**
 * Check if a game has already started based on its commence time.
 * Includes a small buffer (game must have started at least 1 minute ago).
 */
export function hasGameStarted(commenceTime: Date): boolean {
  const bufferMs = 60 * 1000; // 1 minute buffer
  return Date.now() > commenceTime.getTime() + bufferMs;
}

/**
 * Get all upcoming events for a sport (for UI display).
 */
export async function getUpcomingEvents(sport: string): Promise<UpcomingEvent[]> {
  if (sport === 'prizepicks' || sport === 'dfs') {
    return [];
  }

  const events = await fetchUpcomingEvents(sport);
  const now = Date.now();

  // Return only future events, sorted by start time
  return events
    .filter(e => new Date(e.commence_time).getTime() > now)
    .sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
}
