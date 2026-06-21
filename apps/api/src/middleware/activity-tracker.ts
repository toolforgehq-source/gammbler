import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

// Track last_active_at for authenticated users (debounced: at most once per 5 min)
const lastUpdated = new Map<string, number>();
const DEBOUNCE_MS = 5 * 60 * 1000;

export function trackActivity(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.userId) {
    const userId = req.user.userId;
    const now = Date.now();
    const last = lastUpdated.get(userId) || 0;

    if (now - last > DEBOUNCE_MS) {
      lastUpdated.set(userId, now);
      db.update(users)
        .set({ last_active_at: new Date() })
        .where(eq(users.id, userId))
        .catch(() => {}); // fire and forget
    }
  }
  next();
}
