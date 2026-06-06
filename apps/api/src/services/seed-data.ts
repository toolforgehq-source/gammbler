import { db } from '../db';
import { users, gammblerScores, bets, feedEvents, capperProfiles, badges } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const SYNTHETIC_USERS: Array<{ username: string; avatar: null; score: number; tier: string; sports: Record<string, number> }> = [
  { username: 'SharpMike', avatar: null, score: 82.4, tier: 'Elite', sports: { nfl: 85.1, nba: 78.3, mlb: 74.2 } },
  { username: 'VegasVince', avatar: null, score: 76.8, tier: 'Sharp', sports: { nfl: 79.5, nba: 72.1, soccer: 80.0 } },
  { username: 'ParlayPete', avatar: null, score: 71.3, tier: 'Sharp', sports: { nfl: 68.4, nba: 74.9, nhl: 72.0 } },
  { username: 'LockOfTheDay', avatar: null, score: 88.1, tier: 'Elite', sports: { nfl: 91.2, nba: 84.5, mlb: 82.7 } },
  { username: 'SteadyEddie', avatar: null, score: 67.5, tier: 'Sharp', sports: { nfl: 70.2, nba: 63.8, cfb: 68.9 } },
  { username: 'TheAnalyst', avatar: null, score: 79.2, tier: 'Sharp', sports: { nba: 83.4, mlb: 76.0, soccer: 71.5 } },
  { username: 'BetBoss_J', avatar: null, score: 73.6, tier: 'Sharp', sports: { nfl: 76.8, cbb: 71.2, nba: 70.4 } },
  { username: 'KingCapper', avatar: null, score: 91.4, tier: 'Legend', sports: { nfl: 93.1, nba: 89.7, mlb: 87.2 } },
  { username: 'PropMaster', avatar: null, score: 64.8, tier: 'Developing', sports: { nba: 68.2, nfl: 61.4, nhl: 63.9 } },
  { username: 'ML_Machine', avatar: null, score: 77.1, tier: 'Sharp', sports: { mlb: 81.3, nhl: 74.8, nfl: 72.5 } },
  { username: 'SpreadKing', avatar: null, score: 69.5, tier: 'Sharp', sports: { nfl: 73.1, cfb: 67.8, cbb: 65.4 } },
  { username: 'WinStreak_', avatar: null, score: 85.3, tier: 'Elite', sports: { nfl: 87.6, nba: 82.9, soccer: 79.1 } },
  { username: 'SharpAction', avatar: null, score: 74.9, tier: 'Sharp', sports: { nba: 78.1, nfl: 71.3, mlb: 73.8 } },
  { username: 'LocksLoaded', avatar: null, score: 62.1, tier: 'Developing', sports: { nfl: 65.3, nba: 58.7, cfb: 61.9 } },
  { username: 'TheEdge_', avatar: null, score: 80.7, tier: 'Elite', sports: { nfl: 84.2, nba: 77.5, nhl: 78.3 } },
  { username: 'DailyPicks', avatar: null, score: 58.3, tier: 'Developing', sports: { nba: 61.2, nfl: 55.8, mlb: 57.4 } },
  { username: 'CashCapper', avatar: null, score: 83.9, tier: 'Elite', sports: { nfl: 86.5, nba: 81.2, mlb: 80.1 } },
  { username: 'SmartBets', avatar: null, score: 70.4, tier: 'Sharp', sports: { soccer: 74.6, nfl: 68.3, nba: 67.1 } },
];

// Demo cappers — top performers who are visible in the marketplace
const DEMO_CAPPERS = ['KingCapper', 'LockOfTheDay', 'WinStreak_', 'CashCapper', 'SharpMike'];

const FEED_EVENTS_SEED = [
  { username: 'KingCapper', type: 'score_high' as const, data: { score: 91.4, sport: 'overall' } },
  { username: 'LockOfTheDay', type: 'win_streak' as const, data: { streak: 8, sport: 'nfl' } },
  { username: 'WinStreak_', type: 'parlay_hit' as const, data: { legs: 4, payout: 1250, odds: '+1200' } },
  { username: 'CashCapper', type: 'badge_earned' as const, data: { badge: 'elite_status', badge_name: 'Elite Status' } },
  { username: 'SharpMike', type: 'rank_up' as const, data: { old_rank: 15, new_rank: 8, sport: 'overall' } },
  { username: 'TheAnalyst', type: 'win_streak' as const, data: { streak: 5, sport: 'nba' } },
  { username: 'VegasVince', type: 'parlay_hit' as const, data: { legs: 3, payout: 680, odds: '+650' } },
  { username: 'ParlayPete', type: 'badge_earned' as const, data: { badge: 'hot_streak', badge_name: 'Hot Streak' } },
  { username: 'ML_Machine', type: 'score_high' as const, data: { score: 77.1, sport: 'mlb' } },
  { username: 'TheEdge_', type: 'weekly_leader' as const, data: { sport: 'nfl', rank: 1, week: 'Week 14' } },
];

function generateBettingHistory(overallScore: number, sportScores: Record<string, number>): Array<{
  sport: string;
  bet_type: string;
  platform: string;
  selection: string;
  odds: string;
  stake: string;
  result: string;
  profit_loss: string;
  event_name: string;
  is_pregame_verified: boolean;
}> {
  const history: ReturnType<typeof generateBettingHistory> = [];
  const winRate = 0.35 + (overallScore / 100) * 0.3; // Score maps to ~35-65% win rate

  const betSelections: Record<string, string[]> = {
    nfl: ['Chiefs -3.5', 'Bills ML', 'Eagles +7', '49ers -1.5', 'Cowboys Over 44.5', 'Ravens -6', 'Dolphins +3', 'Bengals ML'],
    nba: ['Celtics -4.5', 'Lakers ML', 'Bucks -2', 'Nuggets Over 224', 'Warriors +5.5', '76ers -3', 'Suns ML', 'Knicks +6'],
    mlb: ['Yankees -1.5', 'Dodgers ML', 'Braves Over 8.5', 'Astros -130', 'Mets +1.5', 'Padres Under 7', 'Phillies ML', 'Cubs +120'],
    nhl: ['Rangers -1.5', 'Oilers ML', 'Bruins Over 5.5', 'Panthers -120', 'Knights +1.5', 'Stars ML', 'Avalanche -1.5', 'Leafs Under 6'],
    cfb: ['Alabama -14', 'Georgia ML', 'Ohio State -7', 'Michigan Over 50.5', 'Oregon +3', 'Texas -10', 'Penn State ML', 'USC +6'],
    cbb: ['Duke -5.5', 'UConn ML', 'Kansas -3', 'Purdue Over 140', 'Houston -8', 'Gonzaga +4', 'Marquette ML', 'Auburn -6'],
    soccer: ['Man City -1.5', 'Barcelona ML', 'Liverpool Over 2.5', 'Real Madrid -1', 'Arsenal +0.5', 'PSG ML', 'Bayern -1.5', 'Inter Draw'],
  };

  const platforms = ['draftkings', 'fanduel', 'betmgm', 'caesars'];
  const betTypes = ['spread', 'moneyline', 'over_under', 'prop'];

  for (const [sport, score] of Object.entries(sportScores)) {
    const sportWinRate = 0.35 + (score / 100) * 0.3;
    const numBets = 20 + Math.floor(Math.random() * 30); // 20-50 bets per sport
    const selections = betSelections[sport] || betSelections['nfl'];

    for (let i = 0; i < numBets; i++) {
      const isWin = Math.random() < sportWinRate;
      const isPush = !isWin && Math.random() < 0.05;
      const result = isPush ? 'push' : isWin ? 'win' : 'loss';
      const stake = (20 + Math.floor(Math.random() * 180)).toString();
      const oddsVal = -110 + Math.floor(Math.random() * 60) - 30; // -140 to -80
      const profitLoss = result === 'win'
        ? (parseFloat(stake) * (100 / Math.abs(oddsVal))).toFixed(2)
        : result === 'loss'
        ? (-parseFloat(stake)).toFixed(2)
        : '0';

      history.push({
        sport,
        bet_type: betTypes[Math.floor(Math.random() * betTypes.length)],
        platform: platforms[Math.floor(Math.random() * platforms.length)],
        selection: selections[Math.floor(Math.random() * selections.length)],
        odds: oddsVal.toString(),
        stake,
        result,
        profit_loss: profitLoss,
        event_name: selections[Math.floor(Math.random() * selections.length)].split(' ')[0] + ' vs ' +
          selections[Math.floor(Math.random() * selections.length)].split(' ')[0],
        is_pregame_verified: true,
      });
    }
  }

  return history;
}

export async function seedSocialData(): Promise<{ seeded: boolean; users_created: number; message: string }> {
  // Check if seed data already exists
  const existingSeed = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`email LIKE '%@seed.gammbler.com'`);

  if ((existingSeed[0]?.count ?? 0) > 0) {
    return { seeded: false, users_created: 0, message: 'Seed data already exists' };
  }

  const passwordHash = await bcrypt.hash('seed-user-no-login-' + Date.now(), 12);
  const trialEndsAt = new Date('2020-01-01'); // expired trial — synthetic users are "free" but data shows

  let usersCreated = 0;

  for (const userData of SYNTHETIC_USERS) {
    try {
      // Create user
      const [newUser] = await db.insert(users).values({
        username: userData.username,
        email: `${userData.username.toLowerCase()}@seed.gammbler.com`,
        password_hash: passwordHash,
        trial_ends_at: trialEndsAt,
        subscription_status: 'active', // So their scores show on leaderboard
        is_profile_public: true,
        tos_accepted_at: new Date(),
      }).returning({ id: users.id });

      if (!newUser) continue;

      // Create overall score
      await db.insert(gammblerScores).values({
        user_id: newUser.id,
        sport: 'overall',
        score: userData.score.toFixed(1),
        is_unlocked: true,
        settled_bet_count: 50 + Math.floor(Math.random() * 150),
        win_rate: (0.35 + (userData.score / 100) * 0.3).toFixed(4),
        roi: ((userData.score - 50) * 0.4).toFixed(4),
      });

      // Create sport-specific scores
      for (const [sport, score] of Object.entries(userData.sports)) {
        await db.insert(gammblerScores).values({
          user_id: newUser.id,
          sport: sport as any,
          score: score.toFixed(1),
          is_unlocked: true,
          settled_bet_count: 20 + Math.floor(Math.random() * 50),
          win_rate: (0.35 + (score / 100) * 0.3).toFixed(4),
          roi: ((score - 50) * 0.4).toFixed(4),
        });
      }

      // Generate betting history
      const betHistory = generateBettingHistory(userData.score, userData.sports);
      for (const bet of betHistory) {
        const settledAt = new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)); // past 90 days
        await db.insert(bets).values({
          user_id: newUser.id,
          sport: bet.sport as any,
          bet_type: bet.bet_type as any,
          platform: bet.platform as any,
          selection: bet.selection,
          odds: bet.odds,
          stake: bet.stake,
          result: bet.result as any,
          profit_loss: bet.profit_loss,
          event_name: bet.event_name,
          is_manual: false,
          is_pregame_verified: bet.is_pregame_verified,
          settled_at: settledAt,
          created_at: new Date(settledAt.getTime() - 2 * 60 * 60 * 1000), // created 2h before settling
        });
      }

      // Create capper profile for demo cappers
      if (DEMO_CAPPERS.includes(userData.username)) {
        const bios: Record<string, string> = {
          KingCapper: 'Legend-tier capper. NFL specialist with a 93+ score. Consistent profits since 2021.',
          LockOfTheDay: 'Elite multi-sport analyst. Focused on NFL and NBA with proven track records.',
          'WinStreak_': 'Elite capper specializing in finding value across all major sports.',
          CashCapper: 'Data-driven picks. Elite scores across NFL, NBA, and MLB.',
          SharpMike: 'Sharp bettor with an edge in NFL and NBA markets. 5+ years of tracked results.',
        };

        await db.insert(capperProfiles).values({
          user_id: newUser.id,
          display_name: userData.username,
          bio: bios[userData.username] || 'Verified capper with a proven track record.',
          price_cents: 499 + Math.floor(Math.random() * 500),
          status: 'active',
          total_subscribers: 10 + Math.floor(Math.random() * 90),
          total_tails: 50 + Math.floor(Math.random() * 200),
          verified_score: userData.score.toFixed(1),
        });
      }

      // Add badges for high-scoring users
      const userBadges: string[] = ['first_win'];
      if (userData.score >= 60) userBadges.push('sharp_shooter');
      if (userData.score >= 75) userBadges.push('elite_status', 'hot_streak', 'on_fire');
      if (userData.score >= 85) userBadges.push('consistent', 'veteran');
      if (userData.score >= 90) userBadges.push('legend', 'unstoppable');
      if (userData.sports.nfl && userData.sports.nfl >= 75) userBadges.push('nfl_sharp');
      if (userData.sports.nba && userData.sports.nba >= 75) userBadges.push('nba_sharp');
      if (userData.sports.mlb && userData.sports.mlb >= 75) userBadges.push('mlb_sharp');

      for (const badgeType of userBadges) {
        try {
          await db.insert(badges).values({
            user_id: newUser.id,
            badge_type: badgeType as any,
            earned_at: new Date(Date.now() - Math.floor(Math.random() * 180 * 24 * 60 * 60 * 1000)),
          });
        } catch {
          // Duplicate badge, skip
        }
      }

      usersCreated++;
    } catch (err) {
      console.error(`Failed to create seed user ${userData.username}:`, err);
    }
  }

  // Seed feed events
  for (const event of FEED_EVENTS_SEED) {
    try {
      const [seedUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, event.username))
        .limit(1);

      if (seedUser) {
        await db.insert(feedEvents).values({
          user_id: seedUser.id,
          event_type: event.type,
          event_data: event.data,
          sport: 'overall',
          created_at: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)), // past week
        });
      }
    } catch (err) {
      console.error(`Failed to create feed event for ${event.username}:`, err);
    }
  }

  return { seeded: true, users_created: usersCreated, message: `Created ${usersCreated} synthetic users with betting histories, scores, badges, ${DEMO_CAPPERS.length} demo cappers, and ${FEED_EVENTS_SEED.length} feed events.` };
}
