import { Router, Request, Response } from 'express';
import sharp from 'sharp';
import { db } from '../db';
import { gammblerScores, users, bets, scoreCardGenerations } from '../db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { attachTier } from '../middleware/subscription';

const router = Router();

const FREE_MONTHLY_LIMIT = 1;

function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function buildSvg(
  username: string,
  sport: string,
  scoreVal: number,
  wins: number,
  losses: number,
  roi: number,
  settledCount: number,
  watermark: boolean
): string {
  const tier = scoreVal <= 40 ? 'Recreational'
    : scoreVal <= 60 ? 'Developing'
    : scoreVal <= 75 ? 'Sharp'
    : scoreVal <= 90 ? 'Elite'
    : 'Legend';

  const tierColor = scoreVal <= 40 ? '#ef5350'
    : scoreVal <= 60 ? '#FFD700'
    : scoreVal <= 75 ? '#81c784'
    : scoreVal <= 90 ? '#4caf50'
    : '#FFD700';

  return `
    <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f2912"/>
          <stop offset="100%" stop-color="#163a1a"/>
        </linearGradient>
      </defs>
      <rect width="800" height="500" fill="url(#bg)" rx="20"/>
      <rect x="20" y="20" width="760" height="460" fill="none" stroke="#4caf5040" stroke-width="1" rx="15"/>

      <!-- Header -->
      <text x="50" y="70" fill="#4caf50" font-family="Arial, sans-serif" font-size="28" font-weight="bold"
            letter-spacing="4">GAMMBLER</text>
      <text x="750" y="70" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="16" text-anchor="end"
            letter-spacing="2">${sport.toUpperCase()}</text>

      <!-- Username -->
      <text x="50" y="130" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="22" font-weight="600">
        @${username}
      </text>

      <!-- Score Circle -->
      <circle cx="650" cy="250" r="100" fill="none" stroke="#4caf5040" stroke-width="4"/>
      <circle cx="650" cy="250" r="100" fill="none" stroke="${tierColor}" stroke-width="4"
              stroke-dasharray="${(scoreVal / 100) * 628} 628" transform="rotate(-90 650 250)"/>
      <text x="650" y="240" fill="${tierColor}" font-family="Arial, sans-serif" font-size="64" font-weight="bold"
            text-anchor="middle" dominant-baseline="central">${scoreVal.toFixed(0)}</text>
      <text x="650" y="290" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="16"
            text-anchor="middle" letter-spacing="2">${tier.toUpperCase()}</text>

      <!-- Stats -->
      <text x="50" y="210" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">RECORD</text>
      <text x="50" y="245" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="36" font-weight="bold">
        ${wins}-${losses}</text>

      <text x="50" y="310" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">ROI</text>
      <text x="50" y="345" fill="${roi >= 0 ? '#66bb6a' : '#ef5350'}" font-family="Arial, sans-serif" font-size="36"
            font-weight="bold">${roi >= 0 ? '+' : ''}${roi}%</text>

      <text x="50" y="410" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">BETS</text>
      <text x="50" y="445" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="36" font-weight="bold">
        ${settledCount}</text>

      <!-- Footer -->
      <text x="750" y="470" fill="#4caf5080" font-family="Arial, sans-serif" font-size="12" text-anchor="end"
            letter-spacing="1">gammbler.com</text>

      ${watermark ? `
      <!-- Watermark for free users -->
      <rect x="0" y="455" width="800" height="45" fill="#0f2912" opacity="0.9"/>
      <text x="400" y="482" fill="#4caf50" font-family="Arial, sans-serif" font-size="16" font-weight="bold"
            text-anchor="middle" letter-spacing="3">Get your score at gammbler.com</text>
      ` : ''}
    </svg>
  `;
}

// POST /shareable/card — generate shareable score card image
router.post('/card', authMiddleware, attachTier, async (req: Request, res: Response): Promise<void> => {
  try {
    const { sport = 'overall' } = req.body;
    const userId = req.user!.userId;
    const isPro = req.userTier === 'pro';

    // Free user monthly limit check
    if (!isPro) {
      const monthStart = getMonthStart();
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(scoreCardGenerations)
        .where(
          and(
            eq(scoreCardGenerations.user_id, userId),
            gte(scoreCardGenerations.generated_at, monthStart)
          )
        );

      const cardsThisMonth = countResult?.count ?? 0;
      if (cardsThisMonth >= FREE_MONTHLY_LIMIT) {
        res.status(403).json({
          error: 'Monthly card limit reached',
          message: `Free users can generate ${FREE_MONTHLY_LIMIT} score card per month. Upgrade to Pro for unlimited cards.`,
          cards_used: cardsThisMonth,
          limit: FREE_MONTHLY_LIMIT,
          upgrade: true,
        });
        return;
      }
    }

    const [user] = await db
      .select({ username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const [score] = await db
      .select()
      .from(gammblerScores)
      .where(
        and(
          eq(gammblerScores.user_id, userId),
          eq(gammblerScores.sport, sport as any)
        )
      )
      .limit(1);

    if (!user || !score) {
      res.status(404).json({ error: 'Score not found' });
      return;
    }

    const scoreVal = parseFloat(String(score.score));

    // Get record
    const userBets = await db
      .select()
      .from(bets)
      .where(eq(bets.user_id, userId));

    const sportBets = sport === 'overall'
      ? userBets
      : userBets.filter((b) => b.sport === sport);

    const settled = sportBets.filter((b) => ['win', 'loss', 'push'].includes(b.result));
    const wins = settled.filter((b) => b.result === 'win').length;
    const losses = settled.filter((b) => b.result === 'loss').length;

    const totalStake = settled.reduce((s, b) => s + parseFloat(String(b.stake)), 0);
    const totalPL = settled.reduce((s, b) => s + parseFloat(String(b.profit_loss || '0')), 0);
    const roi = totalStake > 0 ? Math.round((totalPL / totalStake) * 10000) / 100 : 0;

    const svgContent = buildSvg(
      user.username,
      sport,
      scoreVal,
      wins,
      losses,
      roi,
      settled.length,
      !isPro // watermark for free users
    );

    const pngBuffer = await sharp(Buffer.from(svgContent))
      .png()
      .toBuffer();

    // Track generation for free users
    if (!isPro) {
      await db.insert(scoreCardGenerations).values({
        user_id: userId,
        sport: sport as any,
      });
    }

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="gammbler-${user.username}-${sport}.png"`);
    res.send(pngBuffer);
  } catch (err) {
    console.error('Shareable card error:', err);
    res.status(500).json({ error: 'Failed to generate card' });
  }
});

// GET /shareable/card-status — check how many cards free user has left
router.get('/card-status', authMiddleware, attachTier, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const isPro = req.userTier === 'pro';

    if (isPro) {
      res.json({ unlimited: true, cards_remaining: null, limit: null });
      return;
    }

    const monthStart = getMonthStart();
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(scoreCardGenerations)
      .where(
        and(
          eq(scoreCardGenerations.user_id, userId),
          gte(scoreCardGenerations.generated_at, monthStart)
        )
      );

    const cardsUsed = countResult?.count ?? 0;
    res.json({
      unlimited: false,
      cards_used: cardsUsed,
      cards_remaining: Math.max(0, FREE_MONTHLY_LIMIT - cardsUsed),
      limit: FREE_MONTHLY_LIMIT,
    });
  } catch (err) {
    console.error('Card status error:', err);
    res.status(500).json({ error: 'Failed to get card status' });
  }
});

export default router;
