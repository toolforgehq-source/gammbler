export { seedBeliefsFromHistoricalData, upsertBelief, getBelief, computeConfidence } from './belief-engine';
export { createOpportunity, computeEV, markExecuted, recordOutcome, expireStaleOpportunities, getActionQueue } from './opportunity-engine';
export { findStuckUsers, generateOnboardingOpportunities } from './onboarding-engine';
export { detectReferralMoments, generateReferralOpportunities, computeViralCoefficient } from './referral-engine';
export { findChurnRiskUsers, generateRetentionOpportunities } from './retention-engine';
export { generateCreatorOutreachOpportunities, getCreatorSegmentStats, getCreatorSuccessMetrics } from './creator-outreach-engine';
export { discoverAhaMoments } from './aha-moment';
export { getWeeklyCohorts, getCohortTrend } from './cohort-analysis';

import { captureFunnelSnapshot } from '../funnel-snapshot';
import { seedBeliefsFromHistoricalData } from './belief-engine';
import { generateOnboardingOpportunities } from './onboarding-engine';
import { generateReferralOpportunities } from './referral-engine';
import { generateRetentionOpportunities } from './retention-engine';
import { generateCreatorOutreachOpportunities } from './creator-outreach-engine';
import { expireStaleOpportunities } from './opportunity-engine';
import { discoverAhaMoments } from './aha-moment';

export async function runDailyBrainCycle(): Promise<{
  snapshot: boolean;
  expired: number;
  onboarding: number;
  referral: number;
  retention: number;
  creatorOutreach: number;
  ahaMoments: number;
}> {
  console.log('[Growth Brain] Starting daily brain cycle...');

  // 1. Capture funnel snapshot
  let snapshotOk = false;
  try {
    await captureFunnelSnapshot();
    snapshotOk = true;
  } catch (err) {
    console.error('[Growth Brain] Funnel snapshot failed:', err);
  }

  // 2. Expire stale opportunities
  const expired = await expireStaleOpportunities();

  // 3. Generate new opportunities from each engine
  let onboarding = 0;
  let referral = 0;
  let retention = 0;
  let creatorOutreach = 0;

  try {
    onboarding = await generateOnboardingOpportunities();
  } catch (err) {
    console.error('[Growth Brain] Onboarding engine error:', err);
  }

  try {
    referral = await generateReferralOpportunities();
  } catch (err) {
    console.error('[Growth Brain] Referral engine error:', err);
  }

  try {
    retention = await generateRetentionOpportunities();
  } catch (err) {
    console.error('[Growth Brain] Retention engine error:', err);
  }

  try {
    creatorOutreach = await generateCreatorOutreachOpportunities();
  } catch (err) {
    console.error('[Growth Brain] Creator outreach engine error:', err);
  }

  // 4. Discover aha moments
  let ahaMoments = 0;
  try {
    const moments = await discoverAhaMoments();
    ahaMoments = moments.length;
  } catch (err) {
    console.error('[Growth Brain] Aha moment discovery error:', err);
  }

  const result = { snapshot: snapshotOk, expired, onboarding, referral, retention, creatorOutreach, ahaMoments };
  console.log('[Growth Brain] Daily cycle complete:', result);
  return result;
}

export async function initializeGrowthBrain(): Promise<void> {
  console.log('[Growth Brain] Initializing — seeding beliefs from historical data...');
  try {
    await seedBeliefsFromHistoricalData();
    console.log('[Growth Brain] Initialization complete');
  } catch (err) {
    console.error('[Growth Brain] Initialization error:', err);
  }
}
