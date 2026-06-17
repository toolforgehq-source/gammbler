import { db } from '../db';
import { challenges, users } from '../db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { getGameScores, resolveMarket } from './odds-api';
import { createFeedEvent } from './feed';
import { notifyChallengeSettled } from './notifications';
import { checkH2hBadges } from '../routes/challenges';

const SUPPORTED_SPORTS = ['nfl', 'nba', 'mlb', 'nhl', 'cfb', 'cbb', 'soccer'];

export async function settleVerifiedChallenges(): Promise<void> {
  console.log('[Auto-Settlement] Starting verified challenge settlement check...');

  // Find all accepted verified challenges with an event ID
  const pendingChallenges = await db
    .select()
    .from(challenges)
    .where(
      and(
        eq(challenges.status, 'accepted'),
        eq(challenges.is_verified, true),
        sql`${challenges.odds_api_event_id} IS NOT NULL`,
        sql`${challenges.market} IS NOT NULL`
      )
    );

  if (pendingChallenges.length === 0) {
    console.log('[Auto-Settlement] No verified challenges to settle.');
    return;
  }

  console.log(`[Auto-Settlement] Found ${pendingChallenges.length} verified challenges to check.`);

  // Group by sport to batch score fetches
  const bySport = new Map<string, typeof pendingChallenges>();
  for (const c of pendingChallenges) {
    const sport = c.sport;
    if (!bySport.has(sport)) bySport.set(sport, []);
    bySport.get(sport)!.push(c);
  }

  let settledCount = 0;

  for (const [sport, sportChallenges] of bySport) {
    if (!SUPPORTED_SPORTS.includes(sport)) continue;

    const scores = await getGameScores(sport, 3);
    if (scores.length === 0) {
      console.log(`[Auto-Settlement] No scores available for ${sport}`);
      continue;
    }

    // Build a map of event ID → score data
    const scoreMap = new Map(scores.filter(s => s.completed && s.scores).map(s => [s.id, s]));

    for (const challenge of sportChallenges) {
      const gameScore = scoreMap.get(challenge.odds_api_event_id!);
      if (!gameScore || !gameScore.scores) continue;

      // Parse scores
      const homeScoreEntry = gameScore.scores.find(s => s.name === gameScore.home_team);
      const awayScoreEntry = gameScore.scores.find(s => s.name === gameScore.away_team);
      if (!homeScoreEntry || !awayScoreEntry) {
        console.log(`[Auto-Settlement] Score entries not found for event ${challenge.odds_api_event_id}`);
        continue;
      }

      const homeScore = parseInt(homeScoreEntry.score, 10);
      const awayScore = parseInt(awayScoreEntry.score, 10);
      if (isNaN(homeScore) || isNaN(awayScore)) {
        console.log(`[Auto-Settlement] Invalid scores for event ${challenge.odds_api_event_id}: ${homeScoreEntry.score}-${awayScoreEntry.score}`);
        continue;
      }

      // Resolve the market
      const line = challenge.challenger_line ? parseFloat(String(challenge.challenger_line)) : undefined;
      const result = resolveMarket(
        challenge.market!,
        challenge.challenger_pick,
        challenge.home_team || gameScore.home_team,
        challenge.away_team || gameScore.away_team,
        homeScore,
        awayScore,
        line,
      );

      let winnerId: string | null = null;
      if (result === 'challenger') winnerId = challenge.challenger_id;
      else if (result === 'challengee') winnerId = challenge.challengee_id;
      // 'push' → winner_id stays null

      // Update the challenge
      await db
        .update(challenges)
        .set({
          status: 'auto_settled',
          winner_id: winnerId,
          settled_at: new Date(),
          settlement_method: 'auto',
          home_score: homeScore,
          away_score: awayScore,
        })
        .where(eq(challenges.id, challenge.id));

      settledCount++;

      console.log(
        `[Auto-Settlement] Settled challenge ${challenge.id}: ` +
        `${challenge.event_name} → ${homeScore}-${awayScore} → ${result}` +
        (winnerId ? ` (winner: ${winnerId})` : ' (push)')
      );

      // Fire notifications and badges (fire-and-forget)
      try {
        const participantIds = [challenge.challenger_id, challenge.challengee_id];
        const userRows = await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(inArray(users.id, participantIds));
        const userMap = new Map(userRows.map(u => [u.id, u]));

        if (winnerId) {
          const winner = userMap.get(winnerId);
          const loserId = participantIds.find(id => id !== winnerId)!;
          const loser = userMap.get(loserId);

          // Feed event
          await createFeedEvent(winnerId, 'h2h_result', {
            challenge_id: challenge.id,
            winner_username: winner?.username,
            loser_username: loser?.username,
            event_name: challenge.event_name,
            sport: challenge.sport,
            winner_pick: challenge.challenger_id === winnerId
              ? challenge.challenger_pick
              : challenge.challengee_pick,
            auto_settled: true,
            final_score: `${homeScore}-${awayScore}`,
          }, challenge.sport);

          // Badges
          await checkH2hBadges(winnerId);

          // Notifications
          if (winner) {
            notifyChallengeSettled(
              winner.id,
              true,
              loser?.username || 'opponent',
              challenge.event_name,
              challenge.id,
            ).catch(err => console.error('[Auto-Settlement] Notification error:', err));
          }
          if (loser) {
            notifyChallengeSettled(
              loser.id,
              false,
              winner?.username || 'opponent',
              challenge.event_name,
              challenge.id,
            ).catch(err => console.error('[Auto-Settlement] Notification error:', err));
          }
        } else {
          // Push — notify both
          for (const [id, user] of userMap) {
            const oppId = participantIds.find(pid => pid !== id)!;
            const opp = userMap.get(oppId);
            await createFeedEvent(id, 'h2h_result', {
              challenge_id: challenge.id,
              event_name: challenge.event_name,
              sport: challenge.sport,
              result: 'push',
              auto_settled: true,
              final_score: `${homeScore}-${awayScore}`,
            }, challenge.sport);
          }
        }
      } catch (err) {
        console.error(`[Auto-Settlement] Post-settle error for ${challenge.id}:`, err);
      }
    }
  }

  console.log(`[Auto-Settlement] Complete. Settled ${settledCount} challenges.`);
}

// Cancel verified challenges whose games were cancelled (no result after 7 days)
export async function expireStaleVerifiedChallenges(): Promise<void> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const stale = await db
    .update(challenges)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(challenges.status, 'accepted'),
        eq(challenges.is_verified, true),
        sql`${challenges.event_start_time} IS NOT NULL`,
        sql`${challenges.event_start_time} < ${sevenDaysAgo}`
      )
    )
    .returning();

  if (stale.length > 0) {
    console.log(`[Auto-Settlement] Cancelled ${stale.length} stale verified challenges (game > 7 days old).`);
  }
}
