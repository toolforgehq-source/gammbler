import { db } from '../db';
import { dfsScores, dfsScoreSnapshots } from '../db/schema';
import { sql } from 'drizzle-orm';

export async function snapshotAllDfsScores(): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const allScores = await db.select().from(dfsScores);

  if (allScores.length === 0) {
    console.log('[Cron] DFS score snapshot: no scores to snapshot');
    return;
  }

  const values = allScores.map((s) => ({
    user_id: s.user_id,
    sport: s.sport,
    score: s.score,
    snapshot_date: today,
  }));

  await db
    .insert(dfsScoreSnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: [dfsScoreSnapshots.user_id, dfsScoreSnapshots.sport, dfsScoreSnapshots.snapshot_date],
      set: { score: sql`EXCLUDED.score` },
    });

  console.log(`[Cron] DFS score snapshot: saved ${values.length} DFS score records for ${today.toISOString().slice(0, 10)}`);
}
