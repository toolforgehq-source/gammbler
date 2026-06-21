import { db } from '../../db';
import { growthOpportunities, growthOutcomes } from '../../db/schema';
import { eq, sql, and, lte } from 'drizzle-orm';
import { getBelief } from './belief-engine';

export interface OpportunityInput {
  actionType: 'creator_outreach' | 'onboarding_nudge' | 'referral_campaign' | 'retention_campaign';
  channel: string;
  whyThis: string;
  whyNow: string;
  evidence: Record<string, unknown>;
  expectedASBs: number;
  pSuccess: number;
  confidence: number;
  urgency?: number;
  costDollars?: number;
  founderTimeMinutes?: number;
  successCriteria: string;
  learningObjective: string;
  content?: Record<string, unknown>;
  targetType?: string;
  targetId?: string;
  targetMetadata?: Record<string, unknown>;
  isExploratory?: boolean;
  measurementWindowDays?: number;
  expiresAt?: Date;
}

export function computeEV(
  pSuccess: number,
  expectedASBs: number,
  confidence: number,
  urgency: number,
): number {
  return pSuccess * expectedASBs * confidence * urgency;
}

export async function createOpportunity(input: OpportunityInput): Promise<string> {
  const urgency = input.urgency ?? 1.0;
  const ev = computeEV(input.pSuccess, input.expectedASBs, input.confidence, urgency);

  const costDollars = input.costDollars ?? 0;
  const founderMinutes = input.founderTimeMinutes ?? 0;
  const asbsPerDollar = costDollars > 0 ? input.expectedASBs / costDollars : null;
  const asbsPerMinute = founderMinutes > 0 ? input.expectedASBs / founderMinutes : null;

  const expiresAt = input.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [row] = await db
    .insert(growthOpportunities)
    .values({
      action_type: input.actionType,
      channel: input.channel,
      why_this: input.whyThis,
      why_now: input.whyNow,
      evidence: input.evidence,
      expected_asbs: String(input.expectedASBs),
      p_success: String(input.pSuccess),
      confidence: String(input.confidence),
      urgency: String(urgency),
      ev_score: String(ev),
      cost_dollars: String(costDollars),
      founder_time_minutes: founderMinutes,
      asbs_per_dollar: asbsPerDollar ? String(asbsPerDollar) : null,
      asbs_per_minute: asbsPerMinute ? String(asbsPerMinute) : null,
      success_criteria: input.successCriteria,
      learning_objective: input.learningObjective,
      content: input.content ?? null,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      target_metadata: input.targetMetadata ?? null,
      is_exploratory: input.isExploratory ?? false,
      measurement_window_days: input.measurementWindowDays ?? 30,
      expires_at: expiresAt,
    })
    .returning({ id: growthOpportunities.id });

  return row.id;
}

export async function markExecuted(opportunityId: string): Promise<void> {
  await db
    .update(growthOpportunities)
    .set({
      status: 'executed',
      executed_at: new Date(),
    })
    .where(eq(growthOpportunities.id, opportunityId));

  // Create initial outcome record
  await db.insert(growthOutcomes).values({
    opportunity_id: opportunityId,
  });
}

export async function recordOutcome(
  opportunityId: string,
  outcomeData: Partial<typeof growthOutcomes.$inferInsert>,
): Promise<void> {
  const existing = await db
    .select({ id: growthOutcomes.id })
    .from(growthOutcomes)
    .where(eq(growthOutcomes.opportunity_id, opportunityId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(growthOutcomes)
      .set({
        ...outcomeData,
        last_measured_at: new Date(),
      })
      .where(eq(growthOutcomes.opportunity_id, opportunityId));
  } else {
    await db.insert(growthOutcomes).values({
      opportunity_id: opportunityId,
      ...outcomeData,
    });
  }
}

export async function expireStaleOpportunities(): Promise<number> {
  const now = new Date();
  const result = await db
    .update(growthOpportunities)
    .set({ status: 'expired' })
    .where(
      and(
        eq(growthOpportunities.status, 'proposed'),
        lte(growthOpportunities.expires_at, now),
      )
    )
    .returning({ id: growthOpportunities.id });

  return result.length;
}

// Minimum EV threshold: actions below this don't appear in queue
const MIN_EV_THRESHOLD = 0.01;
// Exploration budget: 20% of queue can be exploratory
const EXPLORATION_RATIO = 0.2;

export async function getActionQueue(limit: number = 10): Promise<typeof growthOpportunities.$inferSelect[]> {
  const explorationSlots = Math.max(1, Math.floor(limit * EXPLORATION_RATIO));
  const exploitationSlots = limit - explorationSlots;

  // Get highest EV exploitation opportunities
  const exploitation = await db
    .select()
    .from(growthOpportunities)
    .where(
      and(
        eq(growthOpportunities.status, 'proposed'),
        eq(growthOpportunities.is_exploratory, false),
        sql`${growthOpportunities.ev_score}::numeric >= ${MIN_EV_THRESHOLD}`,
      )
    )
    .orderBy(sql`${growthOpportunities.ev_score} DESC`)
    .limit(exploitationSlots);

  // Get exploratory opportunities (learning actions)
  const exploration = await db
    .select()
    .from(growthOpportunities)
    .where(
      and(
        eq(growthOpportunities.status, 'proposed'),
        eq(growthOpportunities.is_exploratory, true),
      )
    )
    .orderBy(sql`${growthOpportunities.proposed_at} ASC`)
    .limit(explorationSlots);

  return [...exploitation, ...exploration];
}
