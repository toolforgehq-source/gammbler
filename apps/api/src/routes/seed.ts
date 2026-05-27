import { Router, Request, Response } from 'express';
import { seedSocialData } from '../services/seed-data';

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

export default router;
