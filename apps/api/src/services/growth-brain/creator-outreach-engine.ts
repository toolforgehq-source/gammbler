import { db } from '../../db';
import { outreachTargets, capperProfiles, users } from '../../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { getBelief, upsertBelief } from './belief-engine';
import { createOpportunity } from './opportunity-engine';
import { env } from '../../config/env';

const BRAND_URL = env.FRONTEND_URL || 'https://gammbler.com';

interface CreatorSegmentStats {
  segment: string;
  contacted: number;
  replied: number;
  converted: number;
  signupRate: number;
  replyRate: number;
}

export async function getCreatorSegmentStats(): Promise<CreatorSegmentStats[]> {
  const results = await db.execute(sql`
    SELECT
      segment,
      COUNT(*)::int AS contacted,
      COUNT(*) FILTER (WHERE status IN ('replied', 'converted'))::int AS replied,
      COUNT(*) FILTER (WHERE status = 'converted')::int AS converted,
      CASE WHEN COUNT(*) > 0
        THEN COUNT(*) FILTER (WHERE status = 'converted')::float / COUNT(*)
        ELSE 0
      END AS signup_rate,
      CASE WHEN COUNT(*) > 0
        THEN COUNT(*) FILTER (WHERE status IN ('replied', 'converted'))::float / COUNT(*)
        ELSE 0
      END AS reply_rate
    FROM outreach_targets
    WHERE status != 'discovered'
    GROUP BY segment
    ORDER BY signup_rate DESC
  `);

  const rows = (results.rows ?? results) as unknown as Record<string, unknown>[];
  return rows.map((r) => ({
    segment: r.segment as string,
    contacted: r.contacted as number,
    replied: r.replied as number,
    converted: r.converted as number,
    signupRate: r.signup_rate as number,
    replyRate: r.reply_rate as number,
  }));
}

export async function generateCreatorOutreachOpportunities(): Promise<number> {
  // Get queued outreach targets
  const targets = await db
    .select()
    .from(outreachTargets)
    .where(eq(outreachTargets.status, 'discovered'))
    .orderBy(desc(outreachTargets.brain_score))
    .limit(20);

  if (targets.length === 0) return 0;

  // Get segment-level beliefs
  const segmentStats = await getCreatorSegmentStats();
  const globalSignupBelief = await getBelief('creator_outreach.overall.signup_rate');

  let created = 0;

  for (const target of targets) {
    const segment = target.segment || 'unknown';
    const segmentData = segmentStats.find((s) => s.segment === segment);

    // Use segment-specific belief if available, otherwise global
    const segmentBelief = await getBelief(`creator_outreach.segment.${segment}.signup_rate`);
    const signupRate = segmentBelief?.value
      ?? segmentData?.signupRate
      ?? globalSignupBelief?.value
      ?? 0.10;
    const confidence = segmentBelief?.confidence ?? globalSignupBelief?.confidence ?? 0.10;
    const sampleSize = segmentBelief?.sampleSize ?? segmentData?.contacted ?? 0;

    // Check for negative learning: if segment has been tried and failed
    if (segmentData && segmentData.contacted >= 10 && segmentData.converted === 0) {
      // Negative learning: this segment doesn't work
      await upsertBelief(
        `creator_outreach.segment.${segment}.signup_rate`,
        0,
        segmentData.contacted,
        `${segmentData.contacted} creators contacted, 0 conversions. Segment is not viable.`,
      );
      continue;
    }

    const pSuccess = signupRate;
    // Each creator who joins is expected to bring ~10 users on average
    // Of those, assume historical funnel conversion to ASB
    const asbsPerCreator = await getBelief('creator.avg_asbs_generated');
    const expectedASBsPerCreator = asbsPerCreator?.value ?? 5;
    const expectedASBs = pSuccess * expectedASBsPerCreator;

    const isExploratory = sampleSize < 5;

    const urgency = target.engagement_rate
      ? Math.min(2.0, 1 + Number(target.engagement_rate) * 10)
      : 1.0;

    const content = generateOutreachEmail(target);

    await createOpportunity({
      actionType: 'creator_outreach',
      channel: 'email',
      whyThis: `${target.display_name || 'Creator'} (${target.follower_count} followers, ${target.sport_focus || 'sports'}) matches ${segment} segment. Segment signup rate: ${Math.round(signupRate * 100)}% (n=${sampleSize}).`,
      whyNow: isExploratory
        ? `Insufficient data for ${segment} segment. This is an exploratory action to build evidence.`
        : `${segment} segment shows ${Math.round(signupRate * 100)}% signup rate. Each converted creator generates ~${Math.round(expectedASBsPerCreator)} ASBs.`,
      evidence: {
        segment,
        signupRate,
        sampleSize,
        confidence,
        followerCount: target.follower_count,
        engagementRate: target.engagement_rate ? Number(target.engagement_rate) : null,
        sportFocus: target.sport_focus,
      },
      expectedASBs,
      pSuccess,
      confidence,
      urgency,
      costDollars: 0,
      founderTimeMinutes: 5,
      successCriteria: `${target.display_name || 'Creator'} replies, signs up on Gammbler, and becomes an active creator within 60 days.`,
      learningObjective: `Update creator_outreach.segment.${segment}.signup_rate and creator_outreach.segment.${segment}.asb_rate with outcome.`,
      content,
      targetType: 'outreach_target',
      targetId: target.id,
      targetMetadata: {
        displayName: target.display_name,
        platform: target.platform,
        platformId: target.platform_id,
        followerCount: target.follower_count,
        engagementRate: target.engagement_rate ? Number(target.engagement_rate) : null,
        sportFocus: target.sport_focus,
        segment,
      },
      isExploratory,
      measurementWindowDays: 60,
    });

    created++;
  }

  console.log(`[Growth Brain] Generated ${created} creator outreach opportunities`);
  return created;
}

function generateOutreachEmail(target: typeof outreachTargets.$inferSelect): Record<string, unknown> {
  const name = target.display_name || 'there';
  const sport = target.sport_focus || 'sports';

  return {
    subject: `Your ${sport} picks deserve a score, ${name}`,
    body: `Hey ${name},\n\nI noticed you post solid ${sport} picks. Gammbler is a platform where bettors and creators get a verified, data-driven score based on actual results.\n\nCreators like you get:\n- A verified track record that proves your picks work\n- A subscriber base of bettors who can tail your plays\n- Revenue from paid subscriptions\n\nYour followers would see your real win rate, ROI, and score — not just screenshots.\n\nWant to check it out? ${BRAND_URL}\n\nHappy to set you up personally.`,
    tone: 'personal',
  };
}

export async function getCreatorSuccessMetrics(): Promise<{
  totalCreators: number;
  activeCreators: number;
  avgSubscribers: number;
  avgEarnings: number;
  creatorsWithSubscribers: number;
  creatorsWith0Subscribers30d: number;
}> {
  const dataResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_creators,
      COUNT(*) FILTER (WHERE cp.status = 'active')::int AS active_creators,
      COALESCE(AVG(cp.total_subscribers), 0)::numeric AS avg_subscribers,
      COALESCE(AVG(cp.total_earnings_cents), 0)::numeric AS avg_earnings,
      COUNT(*) FILTER (WHERE cp.total_subscribers > 0)::int AS creators_with_subscribers,
      COUNT(*) FILTER (
        WHERE cp.total_subscribers = 0
          AND cp.created_at < NOW() - INTERVAL '30 days'
      )::int AS creators_with_0_subscribers_30d
    FROM capper_profiles cp
  `);

  const d = (dataResult.rows?.[0] ?? dataResult) as Record<string, number>;
  return {
    totalCreators: d.total_creators ?? 0,
    activeCreators: d.active_creators ?? 0,
    avgSubscribers: Math.round((d.avg_subscribers ?? 0) * 10) / 10,
    avgEarnings: Math.round((d.avg_earnings ?? 0)) / 100,
    creatorsWithSubscribers: d.creators_with_subscribers ?? 0,
    creatorsWith0Subscribers30d: d.creators_with_0_subscribers_30d ?? 0,
  };
}
