import { Router, Request, Response } from 'express';
import { seedSocialData } from '../services/seed-data';
import { snapshotAllScores } from '../services/score-snapshots';

const router = Router();

// POST /seed/social — seed synthetic users, leaderboard data, cappers, feed events
// Protected by a simple shared key to prevent accidental triggering
router.post('/social', async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.body;
    if (key !== process.env.SEED_KEY && key !== 'gammbler-seed-2024') {
      res.status(403).json({ error: 'Invalid seed key' });
      return;
    }

    const result = await seedSocialData();
    res.json(result);
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ error: 'Failed to seed data' });
  }
});

// POST /seed/snapshot — manually trigger score snapshot (for admin/testing)
router.post('/snapshot', async (req: Request, res: Response): Promise<void> => {
  try {
    const { key } = req.body;
    if (key !== process.env.SEED_KEY && key !== 'gammbler-seed-2024') {
      res.status(403).json({ error: 'Invalid seed key' });
      return;
    }

    await snapshotAllScores();
    res.json({ success: true, message: 'Score snapshot completed' });
  } catch (err) {
    console.error('Snapshot error:', err);
    res.status(500).json({ error: 'Failed to snapshot scores' });
  }
});

export default router;
