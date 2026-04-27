import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export type UserTier = 'free' | 'pro';

export function getUserTier(subscriptionStatus: string, trialEndsAt: string | Date): UserTier {
  const now = new Date();
  const isTrialing = subscriptionStatus === 'trialing' && new Date(trialEndsAt) > now;
  const isActive = subscriptionStatus === 'active';
  const isPastDue = subscriptionStatus === 'past_due';

  return (isTrialing || isActive || isPastDue) ? 'pro' : 'free';
}

async function loadUserTier(req: Request, res: Response): Promise<UserTier | null> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
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
    return null;
  }

  const tier = getUserTier(user.subscription_status, user.trial_ends_at);
  req.userTier = tier;
  return tier;
}

// Attaches req.userTier but allows both free and pro through
export async function attachTier(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const tier = await loadUserTier(req, res);
  if (tier === null) return;
  next();
}

// Blocks free users — pro-only features
export async function requirePro(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const tier = await loadUserTier(req, res);
  if (tier === null) return;

  if (tier !== 'pro') {
    res.status(403).json({
      error: 'Pro subscription required',
      tier: 'free',
      upgrade: true,
    });
    return;
  }

  next();
}

// Kept for backward compat — same as requirePro
export const requireActiveSubscription = requirePro;
