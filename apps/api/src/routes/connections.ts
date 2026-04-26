import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sportsbookConnections } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { initiateConnection, completeConnection, syncBets } from '../services/sharpsports';

const router = Router();

// GET /connections — list user's sportsbook connections
router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const connections = await db
      .select()
      .from(sportsbookConnections)
      .where(eq(sportsbookConnections.user_id, req.user!.userId));

    res.json({ connections });
  } catch (err) {
    console.error('List connections error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /connections/initiate — start SharpSports OAuth flow
router.post('/initiate', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { platform } = req.body;
    if (!platform) {
      res.status(400).json({ error: 'Platform is required' });
      return;
    }

    const { url } = await initiateConnection(req.user!.userId, platform);
    res.json({ url });
  } catch (err) {
    console.error('Initiate connection error:', err);
    res.status(500).json({ error: 'Failed to initiate connection' });
  }
});

// POST /connections/complete — complete SharpSports OAuth
router.post('/complete', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { platform, sharpsports_account_id } = req.body;
    if (!platform || !sharpsports_account_id) {
      res.status(400).json({ error: 'Platform and account ID required' });
      return;
    }

    await completeConnection(req.user!.userId, platform, sharpsports_account_id);

    // Initial sync
    const imported = await syncBets(req.user!.userId, platform);

    res.json({ success: true, imported });
  } catch (err) {
    console.error('Complete connection error:', err);
    res.status(500).json({ error: 'Failed to complete connection' });
  }
});

// POST /connections/:platform/sync — manually trigger sync
router.post('/:platform/sync', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const imported = await syncBets(req.user!.userId, req.params.platform);
    res.json({ imported });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// DELETE /connections/:platform — disconnect a sportsbook
router.delete('/:platform', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    await db
      .delete(sportsbookConnections)
      .where(
        and(
          eq(sportsbookConnections.user_id, req.user!.userId),
          eq(sportsbookConnections.platform, req.params.platform as any)
        )
      );

    res.json({ success: true });
  } catch (err) {
    console.error('Disconnect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
