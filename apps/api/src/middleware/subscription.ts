import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const [user] = await db
    .select({
      subscription_status: users.subscription_status,
      trial_ends_at: users.trial_ends_at,
    })
    .from(users)
    .where(eq(users.id, req.user.userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const now = new Date();
  const isTrialing = user.subscription_status === 'trialing' && new Date(user.trial_ends_at) > now;
  const isActive = user.subscription_status === 'active';
  const isPastDue = user.subscription_status === 'past_due';

  if (!isTrialing && !isActive && !isPastDue) {
    res.status(403).json({
      error: 'Subscription required',
      subscription_status: user.subscription_status,
      paywall: true,
    });
    return;
  }

  next();
}
