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

// POST /shareable/h2h-card — generate H2H challenge result card
router.post('/h2h-card', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { challenge_id } = req.body;
    const userId = req.user!.userId;

    if (!challenge_id) {
      res.status(400).json({ error: 'challenge_id is required' });
      return;
    }

    // Import challenges table inline to avoid circular deps
    const { challenges } = await import('../db/schema');

    const [challenge] = await db
      .select()
      .from(challenges)
      .where(eq(challenges.id, challenge_id))
      .limit(1);

    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    if (challenge.challenger_id !== userId && challenge.challengee_id !== userId) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    if (challenge.status !== 'settled') {
      res.status(400).json({ error: 'Challenge must be settled to generate a card' });
      return;
    }

    // Get user info
    const participantIds = [challenge.challenger_id, challenge.challengee_id];
    const userRows = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(
        sql`${users.id} IN (${sql.join(participantIds.map(id => sql`${id}`), sql`, `)})`
      );
    const userMap = new Map(userRows.map((u) => [u.id, u.username]));

    // Get scores for both users in this sport
    const scoreRows = await db
      .select()
      .from(gammblerScores)
      .where(
        sql`${gammblerScores.user_id} IN (${sql.join(participantIds.map(id => sql`${id}`), sql`, `)}) AND ${gammblerScores.sport} = ${challenge.sport}`
      );
    const scoreMap = new Map(scoreRows.map((s) => [s.user_id, parseFloat(String(s.score))]));

    const challengerUsername = userMap.get(challenge.challenger_id) || 'Player 1';
    const challengeeUsername = userMap.get(challenge.challengee_id) || 'Player 2';
    const challengerScore = scoreMap.get(challenge.challenger_id) ?? 0;
    const challengeeScore = scoreMap.get(challenge.challengee_id) ?? 0;
    const winnerUsername = challenge.winner_id ? userMap.get(challenge.winner_id) : null;
    const isChallenger = challenge.challenger_id === userId;

    const svgContent = buildH2hSvg(
      challengerUsername,
      challengeeUsername,
      challengerScore,
      challengeeScore,
      challenge.challenger_pick,
      challenge.challengee_pick || '?',
      challenge.event_name,
      challenge.sport,
      winnerUsername || 'Draw',
      challenge.challenger_id === challenge.winner_id
    );

    const pngBuffer = await sharp(Buffer.from(svgContent))
      .png()
      .toBuffer();

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="gammbler-h2h-${challengerUsername}-vs-${challengeeUsername}.png"`);
    res.send(pngBuffer);
  } catch (err) {
    console.error('H2H card error:', err);
    res.status(500).json({ error: 'Failed to generate H2H card' });
  }
});

function buildH2hSvg(
  challengerUsername: string,
  challengeeUsername: string,
  challengerScore: number,
  challengeeScore: number,
  challengerPick: string,
  challengeePick: string,
  eventName: string,
  sport: string,
  winnerName: string,
  challengerWon: boolean
): string {
  const winColor = '#4caf50';
  const loseColor = '#ef5350';

  return `
    <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="h2hbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f2912"/>
          <stop offset="100%" stop-color="#163a1a"/>
        </linearGradient>
      </defs>
      <rect width="800" height="500" fill="url(#h2hbg)" rx="20"/>
      <rect x="20" y="20" width="760" height="460" fill="none" stroke="#4caf5040" stroke-width="1" rx="15"/>

      <!-- Header -->
      <text x="50" y="65" fill="#4caf50" font-family="Arial, sans-serif" font-size="24" font-weight="bold"
            letter-spacing="4">GAMMBLER</text>
      <text x="750" y="65" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="14" text-anchor="end"
            letter-spacing="2">HEAD-TO-HEAD</text>

      <!-- Event -->
      <text x="400" y="110" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="18" font-weight="600"
            text-anchor="middle">${escapeXml(eventName)}</text>
      <text x="400" y="135" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="13"
            text-anchor="middle" letter-spacing="2">${sport.toUpperCase()}</text>

      <!-- VS divider -->
      <line x1="400" y1="160" x2="400" y2="380" stroke="#4caf5030" stroke-width="2"/>
      <circle cx="400" cy="270" r="24" fill="#163a1a" stroke="#4caf50" stroke-width="2"/>
      <text x="400" y="276" fill="#4caf50" font-family="Arial, sans-serif" font-size="16" font-weight="bold"
            text-anchor="middle">VS</text>

      <!-- Challenger (left) -->
      <text x="200" y="185" fill="${challengerWon ? winColor : loseColor}" font-family="Arial, sans-serif" font-size="16"
            font-weight="600" text-anchor="middle">@${escapeXml(challengerUsername)}</text>
      <text x="200" y="230" fill="${challengerWon ? winColor : '#9e9e9e'}" font-family="Arial, sans-serif" font-size="56"
            font-weight="bold" text-anchor="middle">${challengerScore.toFixed(0)}</text>
      <text x="200" y="260" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="12"
            text-anchor="middle" letter-spacing="2">SCORE</text>
      <text x="200" y="310" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="12"
            text-anchor="middle" letter-spacing="2">PICK</text>
      <text x="200" y="340" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="18"
            font-weight="600" text-anchor="middle">${escapeXml(challengerPick)}</text>
      ${challengerWon ? `<text x="200" y="375" fill="${winColor}" font-family="Arial, sans-serif" font-size="14"
            font-weight="bold" text-anchor="middle" letter-spacing="3">WINNER</text>` : ''}

      <!-- Challengee (right) -->
      <text x="600" y="185" fill="${!challengerWon ? winColor : loseColor}" font-family="Arial, sans-serif" font-size="16"
            font-weight="600" text-anchor="middle">@${escapeXml(challengeeUsername)}</text>
      <text x="600" y="230" fill="${!challengerWon ? winColor : '#9e9e9e'}" font-family="Arial, sans-serif" font-size="56"
            font-weight="bold" text-anchor="middle">${challengeeScore.toFixed(0)}</text>
      <text x="600" y="260" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="12"
            text-anchor="middle" letter-spacing="2">SCORE</text>
      <text x="600" y="310" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="12"
            text-anchor="middle" letter-spacing="2">PICK</text>
      <text x="600" y="340" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="18"
            font-weight="600" text-anchor="middle">${escapeXml(challengeePick)}</text>
      ${!challengerWon ? `<text x="600" y="375" fill="${winColor}" font-family="Arial, sans-serif" font-size="14"
            font-weight="bold" text-anchor="middle" letter-spacing="3">WINNER</text>` : ''}

      <!-- Footer -->
      <text x="750" y="470" fill="#4caf5080" font-family="Arial, sans-serif" font-size="12" text-anchor="end"
            letter-spacing="1">gammbler.com</text>
      <text x="50" y="470" fill="#9e9e9e" font-family="Arial, sans-serif" font-size="11"
            letter-spacing="1">Challenge your friends at gammbler.com</text>
    </svg>
  `;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default router;
