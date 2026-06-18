import { db } from '../db';
import { capperProfiles, gammblerScores } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { CAPPER_MIN_SCORE, CAPPER_MIN_BETS } from '@gammbler/shared';

export async function refreshCapperScores(): Promise<void> {
  const cappers = await db
    .select({
      user_id: capperProfiles.user_id,
      status: capperProfiles.status,
      verified_score: capperProfiles.verified_score,
    })
    .from(capperProfiles);

  for (const capper of cappers) {
    const [score] = await db
      .select({
        score: gammblerScores.score,
        settled_bet_count: gammblerScores.settled_bet_count,
      })
      .from(gammblerScores)
      .where(
        and(
          eq(gammblerScores.user_id, capper.user_id),
          eq(gammblerScores.sport, 'overall' as any)
        )
      )
      .limit(1);

    if (!score) continue;

    const currentScore = parseFloat(String(score.score));
    const betCount = score.settled_bet_count;

    // Update stored verified_score to match current
    await db
      .update(capperProfiles)
      .set({ verified_score: String(currentScore) })
      .where(eq(capperProfiles.user_id, capper.user_id));

    // Suspend if they fall below minimum thresholds
    if (capper.status === 'active' && (currentScore < CAPPER_MIN_SCORE || betCount < CAPPER_MIN_BETS)) {
      await db
        .update(capperProfiles)
        .set({ status: 'suspended' })
        .where(eq(capperProfiles.user_id, capper.user_id));
      console.log(`[CapperRefresh] Suspended capper ${capper.user_id} — score: ${currentScore}, bets: ${betCount}`);
    }

    // Reactivate suspended cappers who meet thresholds again
    if (capper.status === 'suspended' && currentScore >= CAPPER_MIN_SCORE && betCount >= CAPPER_MIN_BETS) {
      await db
        .update(capperProfiles)
        .set({ status: 'active' })
        .where(eq(capperProfiles.user_id, capper.user_id));
      console.log(`[CapperRefresh] Reactivated capper ${capper.user_id} — score: ${currentScore}, bets: ${betCount}`);
    }
  }

  console.log(`[CapperRefresh] Refreshed ${cappers.length} capper profiles`);
}
