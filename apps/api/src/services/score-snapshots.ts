import { db } from '../db';
import { gammblerScores, scoreSnapshots } from '../db/schema';
import { sql } from 'drizzle-orm';

export async function snapshotAllScores(): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const allScores = await db.select().from(gammblerScores);

  if (allScores.length === 0) {
    console.log('[Cron] Score snapshot: no scores to snapshot');
    return;
  }

  const values = allScores.map((s) => ({
    user_id: s.user_id,
    sport: s.sport,
    score: s.score,
    snapshot_date: today,
  }));

  await db
    .insert(scoreSnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: [scoreSnapshots.user_id, scoreSnapshots.sport, scoreSnapshots.snapshot_date],
      set: { score: sql`EXCLUDED.score` },
    });

  console.log(`[Cron] Score snapshot: saved ${values.length} score records for ${today.toISOString().slice(0, 10)}`);
}
