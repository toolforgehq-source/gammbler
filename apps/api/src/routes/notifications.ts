import { Router, Request, Response } from 'express';
import { db } from '../db';
import { notifications } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';

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

    const unreadCount = items.filter((n) => !n.read).length;

    res.json({ notifications: items, unread_count: unreadCount, limit, offset });
  } catch (err) {
    console.error('List notifications error:', err);
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

export default router;
