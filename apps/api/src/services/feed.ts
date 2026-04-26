import { db } from '../db';
import { feedEvents, users } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function createFeedEvent(
  userId: string,
  eventType: string,
  eventData: Record<string, unknown>,
  sport?: string | null
): Promise<void> {
  await db.insert(feedEvents).values({
    user_id: userId,
    event_type: eventType as any,
    event_data: eventData,
    sport: sport as any || null,
  });
}
