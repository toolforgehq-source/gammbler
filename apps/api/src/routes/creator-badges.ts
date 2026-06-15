import { Router, Request, Response } from 'express';
import { db } from '../db';
import { creatorBadges } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { checkAndAwardCreatorBadges, getCreatorBadgesForUser, CREATOR_BADGE_DEFS } from '../services/creator-badges';

const router = Router();

// GET /creator-badges — get all badge definitions
router.get('/definitions', authMiddleware, async (_req: Request, res: Response): Promise<void> => {
  res.json({ badges: CREATOR_BADGE_DEFS });
});

// GET /creator-badges/:userId — get badges for a user
router.get('/:userId', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const badges = await getCreatorBadgesForUser(userId);
    res.json({ badges });
  } catch (err) {
    console.error('Creator badges fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /creator-badges/check — check and award badges for current user
router.post('/check', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const awarded = await checkAndAwardCreatorBadges(userId);
    const allBadges = await getCreatorBadgesForUser(userId);
    res.json({ awarded, badges: allBadges });
  } catch (err) {
    console.error('Creator badges check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
