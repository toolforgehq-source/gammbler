import { Router, Request, Response } from 'express';
import { db } from '../db';
import { notifications, pushSubscriptions, users } from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { env } from '../config/env';

const router = Router();

// GET /notifications — list notifications
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const items = await db
      .select()
      .from(notifications)
      .where(eq(notifications.user_id, req.user!.userId))
      .orderBy(desc(notifications.created_at))
      .limit(limit)
      .offset(offset);

    const [unreadResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.user_id, req.user!.userId),
          eq(notifications.read, false)
        )
      );

    res.json({
      notifications: items,
      unread_count: unreadResult?.count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error('List notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /notifications/unread-count — quick unread count for badge
router.get('/unread-count', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.user_id, req.user!.userId),
          eq(notifications.read, false)
        )
      );

    res.json({ unread_count: result?.count ?? 0 });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /notifications/:id/read — mark as read
router.patch('/:id/read', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.id, req.params.id),
          eq(notifications.user_id, req.user!.userId)
        )
      );

    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /notifications/read-all — mark all as read
router.post('/read-all', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.user_id, req.user!.userId),
          eq(notifications.read, false)
        )
      );

    res.json({ success: true });
  } catch (err) {
    console.error('Read all error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Push subscription endpoints ──────────────────────────────

// GET /notifications/vapid-key — public VAPID key for browser push
router.get('/vapid-key', (_req: Request, res: Response): void => {
  res.json({ publicKey: env.VAPID_PUBLIC_KEY || null });
});

// POST /notifications/push-subscribe — register a push subscription
router.post('/push-subscribe', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'Invalid subscription data' });
      return;
    }

    await db
      .insert(pushSubscriptions)
      .values({
        user_id: req.user!.userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      })
      .onConflictDoNothing();

    res.json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /notifications/push-subscribe — unregister push subscription
router.delete('/push-subscribe', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      res.status(400).json({ error: 'Endpoint required' });
      return;
    }

    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.user_id, req.user!.userId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );

    res.json({ success: true });
  } catch (err) {
    console.error('Push unsubscribe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Notification preferences ─────────────────────────────────

// GET /notifications/preferences — get user's notification preferences
router.get('/preferences', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const [user] = await db
      .select({ notification_preferences: users.notification_preferences })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    const defaults = {
      challenges_enabled: true, challenges_email: true, challenges_push: true,
      social_enabled: true, social_email: true, social_push: true,
      score_enabled: true, score_email: true, score_push: true,
      creators_enabled: true, creators_email: true, creators_push: true,
      achievements_enabled: true, achievements_email: true, achievements_push: true,
      leagues_enabled: true, leagues_email: true, leagues_push: true,
    };

    res.json({ preferences: { ...defaults, ...(user?.notification_preferences as object || {}) } });
  } catch (err) {
    console.error('Get preferences error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /notifications/preferences — update notification preferences
router.patch('/preferences', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const [user] = await db
      .select({ notification_preferences: users.notification_preferences })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    const current = (user?.notification_preferences || {}) as Record<string, unknown>;
    const updated = { ...current, ...req.body };

    await db
      .update(users)
      .set({ notification_preferences: updated })
      .where(eq(users.id, req.user!.userId));

    res.json({ preferences: updated });
  } catch (err) {
    console.error('Update preferences error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
