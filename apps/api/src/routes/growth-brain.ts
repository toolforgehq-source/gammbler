import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  funnelSnapshots,
  growthBeliefs,
  growthOpportunities,
  growthOutcomes,
} from '../db/schema';
import { sql, eq, desc, and } from 'drizzle-orm';
import {
  getFunnelCounts,
  computeFunnelStages,
  findBiggestDropoff,
  getNewASBs7d,
  getChurnedASBs7d,
} from '../services/active-scored-bettor';
import { captureFunnelSnapshot } from '../services/funnel-snapshot';
import {
  runDailyBrainCycle,
  initializeGrowthBrain,
  getActionQueue,
  markExecuted,
  recordOutcome,
  computeViralCoefficient,
  getCreatorSuccessMetrics,
  getCreatorSegmentStats,
} from '../services/growth-brain';
import { discoverAhaMoments } from '../services/growth-brain/aha-moment';
import { getWeeklyCohorts, getCohortTrend } from '../services/growth-brain/cohort-analysis';

const router = Router();

// ── GET /growth-brain/dashboard — The daily briefing ─────────
router.get('/dashboard', async (_req: Request, res: Response): Promise<void> => {
  try {
    const counts = await getFunnelCounts();
    const stages = computeFunnelStages(counts);
    const biggestDropoff = findBiggestDropoff(stages);
    const newASBs = await getNewASBs7d();
    const churnedASBs = await getChurnedASBs7d();

    const [latestSnapshot] = await db
      .select()
      .from(funnelSnapshots)
      .orderBy(desc(funnelSnapshots.snapshot_date))
      .limit(1);

    const beliefs = await db
      .select()
      .from(growthBeliefs)
      .orderBy(desc(growthBeliefs.confidence));

    const actionQueue = await getActionQueue(10);

    const viralCoeff = await computeViralCoefficient();
    const cohortTrend = await getCohortTrend();

    res.json({
      // BIGGEST DROP-OFF — always first
      biggestDropoff: biggestDropoff
        ? {
            fromStage: biggestDropoff.fromStage,
            toStage: biggestDropoff.toStage,
            dropoffRate: Math.round(biggestDropoff.dropoffRate * 10000) / 100,
            usersLost: biggestDropoff.usersLost,
            message: `${Math.round(biggestDropoff.dropoffRate * 100)}% of users are lost between "${biggestDropoff.fromStage}" and "${biggestDropoff.toStage}". ${biggestDropoff.usersLost} users never make it past this stage. This is the biggest bottleneck.`,
          }
        : null,

      // NORTH STAR
      northStar: {
        activeScoreBettors: counts.totalActive14d,
        newASBs7d: newASBs,
        churnedASBs7d: churnedASBs,
        netASBGrowth7d: newASBs - churnedASBs,
        viralCoefficient: Math.round(viralCoeff.k * 1000) / 1000,
      },

      // SECONDARY METRICS
      secondaryMetrics: {
        totalUsers: counts.totalUsers,
        totalScoreUnlocked: counts.totalScoreUnlocked,
        totalProSubscribers: counts.totalProSubscribers,
        totalCreators: counts.totalCreators,
        totalActiveCreators: counts.totalActiveCreators,
        active7d: counts.totalActive7d,
      },

      // FUNNEL
      funnel: {
        stages: stages.map((s) => ({
          name: s.name,
          count: s.count,
          conversionRate: s.conversionFromPrevious !== null
            ? Math.round(s.conversionFromPrevious * 10000) / 100
            : null,
        })),
      },

      // COHORT TREND
      cohortTrend: {
        improving: cohortTrend.improving,
        recentASBRate: cohortTrend.recentASBRate,
        previousASBRate: cohortTrend.previousASBRate,
        changePct: cohortTrend.change,
      },

      // ACTION QUEUE (sorted by EV)
      actionQueue: actionQueue.map((op) => ({
        id: op.id,
        actionType: op.action_type,
        channel: op.channel,
        whyThis: op.why_this,
        whyNow: op.why_now,
        evidence: op.evidence,
        expectedASBs: Number(op.expected_asbs),
        pSuccess: Number(op.p_success),
        confidence: Number(op.confidence),
        urgency: Number(op.urgency),
        evScore: Number(op.ev_score),
        costDollars: Number(op.cost_dollars),
        founderTimeMinutes: op.founder_time_minutes,
        asbsPerDollar: op.asbs_per_dollar ? Number(op.asbs_per_dollar) : null,
        asbsPerMinute: op.asbs_per_minute ? Number(op.asbs_per_minute) : null,
        successCriteria: op.success_criteria,
        learningObjective: op.learning_objective,
        content: op.content,
        isExploratory: op.is_exploratory,
        status: op.status,
        proposedAt: op.proposed_at,
      })),

      // BELIEFS (what the Brain currently knows)
      beliefs: beliefs.map((b) => ({
        key: b.belief_key,
        value: Number(b.belief_value),
        sampleSize: b.sample_size,
        confidence: Number(b.confidence),
        previousValue: b.previous_value ? Number(b.previous_value) : null,
        updatedReason: b.updated_reason,
        updatedAt: b.updated_at,
      })),

      latestSnapshot: latestSnapshot ?? null,
    });
  } catch (err) {
    console.error('[Growth Brain] Dashboard error:', err);
    res.status(500).json({ error: 'Failed to generate dashboard' });
  }
});

// ── GET /growth-brain/funnel ─────────────────────────────────
router.get('/funnel', async (_req: Request, res: Response): Promise<void> => {
  try {
    const counts = await getFunnelCounts();
    const stages = computeFunnelStages(counts);
    const biggestDropoff = findBiggestDropoff(stages);
    const newASBs = await getNewASBs7d();
    const churnedASBs = await getChurnedASBs7d();

    res.json({
      counts,
      stages: stages.map((s) => ({
        name: s.name,
        count: s.count,
        conversionRate: s.conversionFromPrevious !== null
          ? Math.round(s.conversionFromPrevious * 10000) / 100
          : null,
      })),
      biggestDropoff,
      asbGrowth: {
        newASBs7d: newASBs,
        churnedASBs7d: churnedASBs,
        netGrowth7d: newASBs - churnedASBs,
      },
    });
  } catch (err) {
    console.error('[Growth Brain] Funnel error:', err);
    res.status(500).json({ error: 'Failed to compute funnel' });
  }
});

// ── POST /growth-brain/snapshot ──────────────────────────────
router.post('/snapshot', async (_req: Request, res: Response): Promise<void> => {
  try {
    await captureFunnelSnapshot();
    res.json({ success: true, message: 'Funnel snapshot captured' });
  } catch (err) {
    console.error('[Growth Brain] Snapshot error:', err);
    res.status(500).json({ error: 'Failed to capture snapshot' });
  }
});

// ── GET /growth-brain/snapshots ──────────────────────────────
router.get('/snapshots', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 30, 90);
    const snapshots = await db
      .select()
      .from(funnelSnapshots)
      .orderBy(desc(funnelSnapshots.snapshot_date))
      .limit(limit);
    res.json({ snapshots });
  } catch (err) {
    console.error('[Growth Brain] Snapshots error:', err);
    res.status(500).json({ error: 'Failed to fetch snapshots' });
  }
});

// ── GET /growth-brain/beliefs ────────────────────────────────
router.get('/beliefs', async (_req: Request, res: Response): Promise<void> => {
  try {
    const allBeliefs = await db
      .select()
      .from(growthBeliefs)
      .orderBy(desc(growthBeliefs.confidence));

    const high = allBeliefs.filter((b) => Number(b.confidence) >= 0.7);
    const medium = allBeliefs.filter((b) => Number(b.confidence) >= 0.3 && Number(b.confidence) < 0.7);
    const low = allBeliefs.filter((b) => Number(b.confidence) < 0.3);

    const changed = allBeliefs.filter((b) =>
      b.previous_value !== null && Number(b.belief_value) !== Number(b.previous_value)
    );

    res.json({
      highConfidence: high.map(formatBelief),
      mediumConfidence: medium.map(formatBelief),
      lowConfidence: low.map(formatBelief),
      recentlyChanged: changed.map(formatBelief),
      totalBeliefs: allBeliefs.length,
    });
  } catch (err) {
    console.error('[Growth Brain] Beliefs error:', err);
    res.status(500).json({ error: 'Failed to fetch beliefs' });
  }
});

// ── POST /growth-brain/opportunities/:id/approve ─────────────
router.post('/opportunities/:id/approve', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [updated] = await db
      .update(growthOpportunities)
      .set({ status: 'approved', approved_at: new Date() })
      .where(and(eq(growthOpportunities.id, id), eq(growthOpportunities.status, 'proposed')))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Opportunity not found or already actioned' });
      return;
    }
    res.json({ success: true, opportunity: updated });
  } catch (err) {
    console.error('[Growth Brain] Approve error:', err);
    res.status(500).json({ error: 'Failed to approve opportunity' });
  }
});

// ── POST /growth-brain/opportunities/:id/reject ──────────────
router.post('/opportunities/:id/reject', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const [updated] = await db
      .update(growthOpportunities)
      .set({ status: 'rejected', rejection_reason: reason || 'No reason provided' })
      .where(and(eq(growthOpportunities.id, id), eq(growthOpportunities.status, 'proposed')))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Opportunity not found or already actioned' });
      return;
    }
    res.json({ success: true, opportunity: updated });
  } catch (err) {
    console.error('[Growth Brain] Reject error:', err);
    res.status(500).json({ error: 'Failed to reject opportunity' });
  }
});

// ── POST /growth-brain/opportunities/:id/execute ─────────────
router.post('/opportunities/:id/execute', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await markExecuted(id);
    res.json({ success: true, message: 'Opportunity marked as executed, outcome tracking started' });
  } catch (err) {
    console.error('[Growth Brain] Execute error:', err);
    res.status(500).json({ error: 'Failed to execute opportunity' });
  }
});

// ── GET /growth-brain/opportunities ──────────────────────────
router.get('/opportunities', async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const validStatuses = ['proposed', 'approved', 'rejected', 'executed', 'measuring', 'expired', 'completed'] as const;

    let opportunities;
    if (status && validStatuses.includes(status as typeof validStatuses[number])) {
      opportunities = await db
        .select()
        .from(growthOpportunities)
        .where(eq(growthOpportunities.status, status as typeof validStatuses[number]))
        .orderBy(desc(growthOpportunities.ev_score))
        .limit(limit);
    } else {
      opportunities = await db
        .select()
        .from(growthOpportunities)
        .orderBy(desc(growthOpportunities.ev_score))
        .limit(limit);
    }

    res.json({ opportunities });
  } catch (err) {
    console.error('[Growth Brain] Opportunities error:', err);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

// ── GET /growth-brain/aha-moments ────────────────────────────
router.get('/aha-moments', async (_req: Request, res: Response): Promise<void> => {
  try {
    const moments = await discoverAhaMoments();
    res.json({
      ahaMoments: moments.map((m) => ({
        action: m.action,
        usersWhoDidIt: m.usersWhoDidIt,
        asbRate: Math.round(m.asbRate * 10000) / 100,
        usersWhoDidntDoIt: m.usersWhoDidntDoIt,
        asbRateWithout: Math.round(m.asbRateWithout * 10000) / 100,
        liftMultiplier: Math.round(m.liftMultiplier * 10) / 10,
        correlationStrength: m.correlationStrength,
      })),
      topPredictor: moments.length > 0 ? moments[0].action : null,
    });
  } catch (err) {
    console.error('[Growth Brain] Aha moments error:', err);
    res.status(500).json({ error: 'Failed to discover aha moments' });
  }
});

// ── GET /growth-brain/cohorts ────────────────────────────────
router.get('/cohorts', async (req: Request, res: Response): Promise<void> => {
  try {
    const weeks = Math.min(parseInt(req.query.weeks as string) || 12, 52);
    const cohorts = await getWeeklyCohorts(weeks);
    const trend = await getCohortTrend();
    res.json({ cohorts, trend });
  } catch (err) {
    console.error('[Growth Brain] Cohorts error:', err);
    res.status(500).json({ error: 'Failed to compute cohorts' });
  }
});

// ── GET /growth-brain/viral ──────────────────────────────────
router.get('/viral', async (_req: Request, res: Response): Promise<void> => {
  try {
    const viral = await computeViralCoefficient();
    res.json({
      viralCoefficient: Math.round(viral.k * 1000) / 1000,
      invitationsPerUser: Math.round(viral.invitationsPerUser * 1000) / 1000,
      conversionPerInvitation: viral.conversionPerInvitation,
      totalUsers: viral.totalUsers,
      referredUsers: viral.referredUsers,
      interpretation: viral.k >= 1
        ? 'Viral growth: each user brings more than 1 new user on average.'
        : viral.k >= 0.5
          ? 'Strong organic amplification. Each 10 users eventually generate ' + Math.round(10 / (1 - viral.k)) + ' total.'
          : viral.k >= 0.1
            ? 'Moderate word-of-mouth. Focus on increasing referral participation rate.'
            : 'Low viral coefficient. Referral optimization is a high-leverage opportunity.',
    });
  } catch (err) {
    console.error('[Growth Brain] Viral error:', err);
    res.status(500).json({ error: 'Failed to compute viral coefficient' });
  }
});

// ── GET /growth-brain/creators ───────────────────────────────
router.get('/creators', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [success, segments] = await Promise.all([
      getCreatorSuccessMetrics(),
      getCreatorSegmentStats(),
    ]);
    res.json({ success, segments });
  } catch (err) {
    console.error('[Growth Brain] Creators error:', err);
    res.status(500).json({ error: 'Failed to fetch creator metrics' });
  }
});

// ── POST /growth-brain/run-cycle — Manually trigger daily cycle
router.post('/run-cycle', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await runDailyBrainCycle();
    res.json({ success: true, result });
  } catch (err) {
    console.error('[Growth Brain] Run cycle error:', err);
    res.status(500).json({ error: 'Failed to run brain cycle' });
  }
});

// ── POST /growth-brain/initialize — Seed beliefs from history
router.post('/initialize', async (_req: Request, res: Response): Promise<void> => {
  try {
    await initializeGrowthBrain();
    res.json({ success: true, message: 'Growth Brain initialized with historical beliefs' });
  } catch (err) {
    console.error('[Growth Brain] Initialize error:', err);
    res.status(500).json({ error: 'Failed to initialize' });
  }
});

function formatBelief(b: typeof growthBeliefs.$inferSelect) {
  return {
    key: b.belief_key,
    value: Number(b.belief_value),
    sampleSize: b.sample_size,
    confidence: Number(b.confidence),
    previousValue: b.previous_value ? Number(b.previous_value) : null,
    previousSampleSize: b.previous_sample_size,
    updatedReason: b.updated_reason,
    updatedAt: b.updated_at,
  };
}

export default router;
