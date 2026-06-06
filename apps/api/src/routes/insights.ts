import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requirePro } from '../middleware/subscription';
import { generateInsights } from '../services/insights';
import { db } from '../db';
import { weeklyReports, bets, gammblerScores } from '../db/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';

const router = Router();

// GET /insights — get personalized insights
router.get('/', authMiddleware, requirePro, async (req: Request, res: Response): Promise<void> => {
  try {
    const insights = await generateInsights(req.user!.userId);
    res.json({ insights });
  } catch (err) {
    console.error('Insights error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /insights/weekly-report — get latest weekly report
router.get('/weekly-report', authMiddleware, requirePro, async (req: Request, res: Response): Promise<void> => {
  try {
    const [report] = await db
      .select()
      .from(weeklyReports)
      .where(eq(weeklyReports.user_id, req.user!.userId))
      .orderBy(desc(weeklyReports.created_at))
      .limit(1);

    if (!report) {
      res.json({ report: null });
      return;
    }

    res.json({ report });
  } catch (err) {
    console.error('Weekly report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /insights/weekly-reports — get all weekly reports
router.get('/weekly-reports', authMiddleware, requirePro, async (req: Request, res: Response): Promise<void> => {
  try {
    const reports = await db
      .select()
      .from(weeklyReports)
      .where(eq(weeklyReports.user_id, req.user!.userId))
      .orderBy(desc(weeklyReports.created_at))
      .limit(12);

    res.json({ reports });
  } catch (err) {
    console.error('Weekly reports error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
