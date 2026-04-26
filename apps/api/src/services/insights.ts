import { db } from '../db';
import { bets } from '../db/schema';
import { eq } from 'drizzle-orm';

interface Insight {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
}

export async function generateInsights(userId: string): Promise<Insight[]> {
  const userBets = await db
    .select()
    .from(bets)
    .where(eq(bets.user_id, userId));

  const settled = userBets.filter((b) => ['win', 'loss', 'push'].includes(b.result));
  if (settled.length < 20) return [];

  const insights: Insight[] = [];
  let idCounter = 0;

  // ── Parlay analysis ────────────────────────────────────────
  const parlays = settled.filter((b) => b.bet_type === 'parlay');
  const straightBets = settled.filter((b) => b.bet_type !== 'parlay');

  if (parlays.length >= 5) {
    const parlayStake = parlays.reduce((s, b) => s + parseFloat(String(b.stake)), 0);
    const parlayPL = parlays.reduce((s, b) => s + parseFloat(String(b.profit_loss || '0')), 0);
    const parlayROI = parlayStake > 0 ? (parlayPL / parlayStake) * 100 : 0;

    const straightStake = straightBets.reduce((s, b) => s + parseFloat(String(b.stake)), 0);
    const straightPL = straightBets.reduce((s, b) => s + parseFloat(String(b.profit_loss || '0')), 0);
    const straightROI = straightStake > 0 ? (straightPL / straightStake) * 100 : 0;

    if (parlayROI < -20 && straightROI > parlayROI) {
      insights.push({
        id: `insight-${++idCounter}`,
        title: 'Parlays are hurting you',
        description: `Your parlay ROI is ${parlayROI.toFixed(1)}%. Your straight bets are at ${straightROI.toFixed(1)}%. Consider reducing parlays.`,
        impact: 'high',
        category: 'bet_type',
      });
    }
  }

  // ── Sport-specific performance ─────────────────────────────
  const bySport: Record<string, typeof settled> = {};
  for (const bet of settled) {
    if (!bySport[bet.sport]) bySport[bet.sport] = [];
    bySport[bet.sport].push(bet);
  }

  for (const [sport, sportBets] of Object.entries(bySport)) {
    if (sportBets.length < 10) continue;
    const stake = sportBets.reduce((s, b) => s + parseFloat(String(b.stake)), 0);
    const pl = sportBets.reduce((s, b) => s + parseFloat(String(b.profit_loss || '0')), 0);
    const roi = stake > 0 ? (pl / stake) * 100 : 0;
    const wins = sportBets.filter((b) => b.result === 'win').length;
    const winRate = (wins / sportBets.length) * 100;

    if (roi > 10) {
      insights.push({
        id: `insight-${++idCounter}`,
        title: `Strong ${sport.toUpperCase()} performance`,
        description: `Your best ROI is ${sport.toUpperCase()} at +${roi.toFixed(1)}% with a ${winRate.toFixed(0)}% win rate.`,
        impact: 'medium',
        category: 'sport',
      });
    }

    if (roi < -25) {
      insights.push({
        id: `insight-${++idCounter}`,
        title: `${sport.toUpperCase()} is costing you`,
        description: `Your ${sport.toUpperCase()} ROI is ${roi.toFixed(1)}%. Consider reducing or rethinking your approach.`,
        impact: 'high',
        category: 'sport',
      });
    }
  }

  // ── Bet type breakdown ─────────────────────────────────────
  const byType: Record<string, typeof settled> = {};
  for (const bet of settled) {
    if (!byType[bet.bet_type]) byType[bet.bet_type] = [];
    byType[bet.bet_type].push(bet);
  }

  let bestType = '';
  let bestTypeROI = -Infinity;
  for (const [type, typeBets] of Object.entries(byType)) {
    if (typeBets.length < 5) continue;
    const stake = typeBets.reduce((s, b) => s + parseFloat(String(b.stake)), 0);
    const pl = typeBets.reduce((s, b) => s + parseFloat(String(b.profit_loss || '0')), 0);
    const roi = stake > 0 ? (pl / stake) * 100 : 0;
    if (roi > bestTypeROI) {
      bestTypeROI = roi;
      bestType = type;
    }
  }

  if (bestType && bestTypeROI > 5) {
    insights.push({
      id: `insight-${++idCounter}`,
      title: `Your strongest bet type`,
      description: `Your best ROI is ${formatBetType(bestType)} bets at +${bestTypeROI.toFixed(1)}%.`,
      impact: 'medium',
      category: 'bet_type',
    });
  }

  // ── Loss chasing detection ─────────────────────────────────
  const sortedByTime = [...settled].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  let chasingCount = 0;
  for (let i = 1; i < sortedByTime.length; i++) {
    const prev = sortedByTime[i - 1];
    const curr = sortedByTime[i];
    if (prev.result === 'loss') {
      const timeDiff = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
      const twoHours = 2 * 60 * 60 * 1000;
      if (timeDiff < twoHours && parseFloat(String(curr.stake)) > parseFloat(String(prev.stake)) * 1.5) {
        chasingCount++;
      }
    }
  }

  if (chasingCount >= 3) {
    insights.push({
      id: `insight-${++idCounter}`,
      title: 'Loss chasing detected',
      description: `You've placed ${chasingCount} bets within 2 hours of a loss with increased stakes. This pattern typically hurts ROI.`,
      impact: 'high',
      category: 'behavior',
    });
  }

  // ── CLV analysis ───────────────────────────────────────────
  const betsWithClosing = settled.filter((b) => b.closing_odds !== null);
  if (betsWithClosing.length >= 10) {
    const beatCount = betsWithClosing.filter((b) => {
      const open = parseFloat(String(b.odds));
      const close = parseFloat(String(b.closing_odds));
      return close < open;
    }).length;
    const clvRate = (beatCount / betsWithClosing.length) * 100;

    if (clvRate >= 55) {
      insights.push({
        id: `insight-${++idCounter}`,
        title: 'You beat the closing line consistently',
        description: `You beat the closing line ${clvRate.toFixed(0)}% of the time — that's genuinely sharp.`,
        impact: 'medium',
        category: 'skill',
      });
    }
  }

  // Sort by impact and return top 5
  const impactOrder = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

  return insights.slice(0, 5);
}

function formatBetType(type: string): string {
  const names: Record<string, string> = {
    spread: 'Spread',
    moneyline: 'Moneyline',
    over_under: 'Over/Under',
    parlay: 'Parlay',
    prop: 'Prop',
    player_prop: 'Player Prop',
    teaser: 'Teaser',
    futures: 'Futures',
  };
  return names[type] || type;
}
