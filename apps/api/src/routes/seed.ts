import { Router, Request, Response } from 'express';
import { seedSocialData } from '../services/seed-data';
import { snapshotAllScores } from '../services/score-snapshots';
import { env } from '../config/env';

const router = Router();

function validateSeedAccess(req: Request, res: Response): boolean {
  // Seed routes are disabled in production unless ALLOW_SEED=true
  if (env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
    console.warn(`[Seed] Blocked seed attempt in production from ${req.ip}`);
    res.status(403).json({ error: 'Seed routes are disabled in production' });
    return false;
  }

  const { key } = req.body;
  if (!process.env.SEED_KEY) {
    console.warn(`[Seed] SEED_KEY not configured — seed attempt blocked from ${req.ip}`);
    res.status(403).json({ error: 'Seed key not configured' });
    return false;
  }

  if (key !== process.env.SEED_KEY) {
    console.warn(`[Seed] Invalid seed key attempt from ${req.ip}`);
    res.status(403).json({ error: 'Invalid seed key' });
    return false;
  }

  return true;
}

// POST /seed/social — seed synthetic users, leaderboard data, cappers, feed events
router.post('/social', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!validateSeedAccess(req, res)) return;

    console.log(`[Seed] Social seed triggered from ${req.ip}`);
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
    if (!validateSeedAccess(req, res)) return;

    console.log(`[Seed] Snapshot triggered from ${req.ip}`);
    await snapshotAllScores();
    res.json({ success: true, message: 'Score snapshot completed' });
  } catch (err) {
    console.error('Snapshot error:', err);
    res.status(500).json({ error: 'Failed to snapshot scores' });
  }
});

export default router;
