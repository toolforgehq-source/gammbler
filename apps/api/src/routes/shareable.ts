import { Router, Request, Response } from 'express';
import sharp from 'sharp';
import { db } from '../db';
import { gammblerScores, users, bets } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import path from 'path';
import fs from 'fs';

const router = Router();

// POST /shareable/card — generate shareable score card image
router.post('/card', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { sport = 'overall' } = req.body;
    const userId = req.user!.userId;

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

    const svgContent = `
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
          @${user.username}
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
          ${settled.length}</text>

        <!-- Footer -->
        <text x="750" y="470" fill="#4caf5080" font-family="Arial, sans-serif" font-size="12" text-anchor="end"
              letter-spacing="1">gammbler.com</text>
      </svg>
    `;

    const pngBuffer = await sharp(Buffer.from(svgContent))
      .png()
      .toBuffer();

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="gammbler-${user.username}-${sport}.png"`);
    res.send(pngBuffer);
  } catch (err) {
    console.error('Shareable card error:', err);
    res.status(500).json({ error: 'Failed to generate card' });
  }
});

export default router;
