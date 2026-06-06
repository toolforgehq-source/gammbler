import { env } from '../config/env';

interface ParsedBet {
  sport: string | null;
  bet_type: string | null;
  selection: string | null;
  odds: string | null;
  stake: string | null;
  platform: string | null;
  event_name: string | null;
  confidence: number;
}

const SPORT_MAP: Record<string, string> = {
  football: 'nfl', nfl: 'nfl',
  basketball: 'nba', nba: 'nba',
  baseball: 'mlb', mlb: 'mlb',
  hockey: 'nhl', nhl: 'nhl',
  'college football': 'cfb', cfb: 'cfb', ncaaf: 'cfb',
  'college basketball': 'cbb', cbb: 'cbb', ncaab: 'cbb',
  soccer: 'soccer', mls: 'soccer', epl: 'soccer', 'premier league': 'soccer',
  prizepicks: 'prizepicks',
  dfs: 'dfs',
};

const BET_TYPE_MAP: Record<string, string> = {
  spread: 'spread', 'point spread': 'spread',
  moneyline: 'moneyline', ml: 'moneyline', 'money line': 'moneyline',
  total: 'over_under', 'over/under': 'over_under', over: 'over_under', under: 'over_under',
  parlay: 'parlay',
  prop: 'prop', 'player prop': 'player_prop',
  teaser: 'teaser',
  futures: 'futures', future: 'futures',
};

const PLATFORM_MAP: Record<string, string> = {
  draftkings: 'draftkings', dk: 'draftkings',
  fanduel: 'fanduel', fd: 'fanduel',
  betmgm: 'betmgm', mgm: 'betmgm',
  caesars: 'caesars',
  'espn bet': 'espn_bet', espnbet: 'espn_bet',
  pointsbet: 'pointsbet',
  prizepicks: 'prizepicks',
  underdog: 'underdog',
};

function normalizeField(value: string | null, map: Record<string, string>): string | null {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  return map[lower] || null;
}

export async function parseScreenshot(imageBase64: string): Promise<ParsedBet> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const prompt = `You are a sportsbook bet slip parser. Analyze this screenshot of a sports betting slip and extract the following fields. Return ONLY valid JSON with no additional text.

Required fields:
- sport: The sport (e.g., "NFL", "NBA", "MLB", "NHL", "CFB", "CBB", "Soccer")
- bet_type: The type of bet (e.g., "spread", "moneyline", "over_under", "parlay", "prop", "player_prop", "teaser", "futures")
- selection: The specific pick/selection (e.g., "Chiefs -3.5", "Lakers ML", "Over 224.5")
- odds: American odds as a string (e.g., "-110", "+150", "-200")
- stake: The wager amount in dollars as a string (e.g., "100", "50.00"). If not visible, return null.
- platform: The sportsbook platform (e.g., "DraftKings", "FanDuel", "BetMGM", "Caesars", "ESPN Bet")
- event_name: The event/game name (e.g., "Chiefs vs Bills", "Lakers vs Celtics")
- confidence: A number 0-100 representing how confident you are in the parsing accuracy

If you cannot determine a field, set it to null. Always return valid JSON.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content || '';

  // Extract JSON from the response (handle markdown code blocks)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse GPT response as JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    sport: normalizeField(parsed.sport, SPORT_MAP),
    bet_type: normalizeField(parsed.bet_type, BET_TYPE_MAP),
    selection: parsed.selection || null,
    odds: parsed.odds || null,
    stake: parsed.stake || null,
    platform: normalizeField(parsed.platform, PLATFORM_MAP),
    event_name: parsed.event_name || null,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 50,
  };
}
