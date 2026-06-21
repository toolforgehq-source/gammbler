import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { upsertBelief } from './belief-engine';

export interface AhaMomentCandidate {
  action: string;
  usersWhoDidIt: number;
  asbRate: number;
  usersWhoDidntDoIt: number;
  asbRateWithout: number;
  liftMultiplier: number;
  correlationStrength: 'strong' | 'moderate' | 'weak';
}

export async function discoverAhaMoments(): Promise<AhaMomentCandidate[]> {
  const days14Ago = new Date();
  days14Ago.setDate(days14Ago.getDate() - 14);

  const candidates: AhaMomentCandidate[] = [];

  // 1. Connected sportsbook in first 7 days
  const sportsbookResult = await db.execute(sql`
    WITH early_connectors AS (
      SELECT u.id AS user_id,
        EXISTS (
          SELECT 1 FROM gammbler_scores gs
          WHERE gs.user_id = u.id AND gs.sport = 'overall' AND gs.is_unlocked = true
            AND EXISTS (SELECT 1 FROM bets b WHERE b.user_id = u.id AND b.created_at >= ${days14Ago})
        ) AS is_asb
      FROM users u
      JOIN sportsbook_connections sc ON sc.user_id = u.id
      WHERE sc.connected_at <= u.created_at + INTERVAL '7 days'
        AND u.created_at < NOW() - INTERVAL '30 days'
    ),
    non_connectors AS (
      SELECT u.id AS user_id,
        EXISTS (
          SELECT 1 FROM gammbler_scores gs
          WHERE gs.user_id = u.id AND gs.sport = 'overall' AND gs.is_unlocked = true
            AND EXISTS (SELECT 1 FROM bets b WHERE b.user_id = u.id AND b.created_at >= ${days14Ago})
        ) AS is_asb
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM sportsbook_connections sc
        WHERE sc.user_id = u.id AND sc.connected_at <= u.created_at + INTERVAL '7 days'
      )
        AND u.created_at < NOW() - INTERVAL '30 days'
    )
    SELECT
      (SELECT COUNT(*)::int FROM early_connectors) AS did_it,
      (SELECT COUNT(*) FILTER (WHERE is_asb)::int FROM early_connectors) AS did_it_asb,
      (SELECT COUNT(*)::int FROM non_connectors) AS didnt_do_it,
      (SELECT COUNT(*) FILTER (WHERE is_asb)::int FROM non_connectors) AS didnt_do_it_asb
  `);

  const sb = (sportsbookResult.rows?.[0] ?? sportsbookResult) as Record<string, number>;
  if (sb.did_it > 0 && sb.didnt_do_it > 0) {
    const rateWith = sb.did_it_asb / sb.did_it;
    const rateWithout = sb.didnt_do_it_asb / sb.didnt_do_it;
    const lift = rateWithout > 0 ? rateWith / rateWithout : rateWith > 0 ? 10 : 1;
    candidates.push({
      action: 'Connected sportsbook within 7 days',
      usersWhoDidIt: sb.did_it,
      asbRate: rateWith,
      usersWhoDidntDoIt: sb.didnt_do_it,
      asbRateWithout: rateWithout,
      liftMultiplier: lift,
      correlationStrength: lift >= 3 ? 'strong' : lift >= 1.5 ? 'moderate' : 'weak',
    });
  }

  // 2. Placed 3+ bets in first 3 days
  const earlyBetsResult = await db.execute(sql`
    WITH early_bettors AS (
      SELECT u.id AS user_id,
        EXISTS (
          SELECT 1 FROM gammbler_scores gs
          WHERE gs.user_id = u.id AND gs.sport = 'overall' AND gs.is_unlocked = true
            AND EXISTS (SELECT 1 FROM bets b WHERE b.user_id = u.id AND b.created_at >= ${days14Ago})
        ) AS is_asb
      FROM users u
      WHERE (SELECT COUNT(*) FROM bets b WHERE b.user_id = u.id AND b.created_at <= u.created_at + INTERVAL '3 days') >= 3
        AND u.created_at < NOW() - INTERVAL '30 days'
    ),
    non_early AS (
      SELECT u.id AS user_id,
        EXISTS (
          SELECT 1 FROM gammbler_scores gs
          WHERE gs.user_id = u.id AND gs.sport = 'overall' AND gs.is_unlocked = true
            AND EXISTS (SELECT 1 FROM bets b WHERE b.user_id = u.id AND b.created_at >= ${days14Ago})
        ) AS is_asb
      FROM users u
      WHERE (SELECT COUNT(*) FROM bets b WHERE b.user_id = u.id AND b.created_at <= u.created_at + INTERVAL '3 days') < 3
        AND u.created_at < NOW() - INTERVAL '30 days'
    )
    SELECT
      (SELECT COUNT(*)::int FROM early_bettors) AS did_it,
      (SELECT COUNT(*) FILTER (WHERE is_asb)::int FROM early_bettors) AS did_it_asb,
      (SELECT COUNT(*)::int FROM non_early) AS didnt_do_it,
      (SELECT COUNT(*) FILTER (WHERE is_asb)::int FROM non_early) AS didnt_do_it_asb
  `);

  const eb = (earlyBetsResult.rows?.[0] ?? earlyBetsResult) as Record<string, number>;
  if (eb.did_it > 0 && eb.didnt_do_it > 0) {
    const rateWith = eb.did_it_asb / eb.did_it;
    const rateWithout = eb.didnt_do_it_asb / eb.didnt_do_it;
    const lift = rateWithout > 0 ? rateWith / rateWithout : rateWith > 0 ? 10 : 1;
    candidates.push({
      action: 'Placed 3+ bets within first 3 days',
      usersWhoDidIt: eb.did_it,
      asbRate: rateWith,
      usersWhoDidntDoIt: eb.didnt_do_it,
      asbRateWithout: rateWithout,
      liftMultiplier: lift,
      correlationStrength: lift >= 3 ? 'strong' : lift >= 1.5 ? 'moderate' : 'weak',
    });
  }

  // 3. Followed at least 1 user in first 7 days
  const followsResult = await db.execute(sql`
    WITH early_followers AS (
      SELECT u.id AS user_id,
        EXISTS (
          SELECT 1 FROM gammbler_scores gs
          WHERE gs.user_id = u.id AND gs.sport = 'overall' AND gs.is_unlocked = true
            AND EXISTS (SELECT 1 FROM bets b WHERE b.user_id = u.id AND b.created_at >= ${days14Ago})
        ) AS is_asb
      FROM users u
      WHERE EXISTS (
        SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.created_at <= u.created_at + INTERVAL '7 days'
      )
        AND u.created_at < NOW() - INTERVAL '30 days'
    ),
    non_followers AS (
      SELECT u.id AS user_id,
        EXISTS (
          SELECT 1 FROM gammbler_scores gs
          WHERE gs.user_id = u.id AND gs.sport = 'overall' AND gs.is_unlocked = true
            AND EXISTS (SELECT 1 FROM bets b WHERE b.user_id = u.id AND b.created_at >= ${days14Ago})
        ) AS is_asb
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.created_at <= u.created_at + INTERVAL '7 days'
      )
        AND u.created_at < NOW() - INTERVAL '30 days'
    )
    SELECT
      (SELECT COUNT(*)::int FROM early_followers) AS did_it,
      (SELECT COUNT(*) FILTER (WHERE is_asb)::int FROM early_followers) AS did_it_asb,
      (SELECT COUNT(*)::int FROM non_followers) AS didnt_do_it,
      (SELECT COUNT(*) FILTER (WHERE is_asb)::int FROM non_followers) AS didnt_do_it_asb
  `);

  const fl = (followsResult.rows?.[0] ?? followsResult) as Record<string, number>;
  if (fl.did_it > 0 && fl.didnt_do_it > 0) {
    const rateWith = fl.did_it_asb / fl.did_it;
    const rateWithout = fl.didnt_do_it_asb / fl.didnt_do_it;
    const lift = rateWithout > 0 ? rateWith / rateWithout : rateWith > 0 ? 10 : 1;
    candidates.push({
      action: 'Followed at least 1 user within 7 days',
      usersWhoDidIt: fl.did_it,
      asbRate: rateWith,
      usersWhoDidntDoIt: fl.didnt_do_it,
      asbRateWithout: rateWithout,
      liftMultiplier: lift,
      correlationStrength: lift >= 3 ? 'strong' : lift >= 1.5 ? 'moderate' : 'weak',
    });
  }

  // 4. Created/accepted a H2H challenge in first 14 days
  const challengesResult = await db.execute(sql`
    WITH early_challengers AS (
      SELECT u.id AS user_id,
        EXISTS (
          SELECT 1 FROM gammbler_scores gs
          WHERE gs.user_id = u.id AND gs.sport = 'overall' AND gs.is_unlocked = true
            AND EXISTS (SELECT 1 FROM bets b WHERE b.user_id = u.id AND b.created_at >= ${days14Ago})
        ) AS is_asb
      FROM users u
      WHERE EXISTS (
        SELECT 1 FROM challenges c
        WHERE (c.challenger_id = u.id OR c.challengee_id = u.id)
          AND c.created_at <= u.created_at + INTERVAL '14 days'
      )
        AND u.created_at < NOW() - INTERVAL '30 days'
    ),
    non_challengers AS (
      SELECT u.id AS user_id,
        EXISTS (
          SELECT 1 FROM gammbler_scores gs
          WHERE gs.user_id = u.id AND gs.sport = 'overall' AND gs.is_unlocked = true
            AND EXISTS (SELECT 1 FROM bets b WHERE b.user_id = u.id AND b.created_at >= ${days14Ago})
        ) AS is_asb
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM challenges c
        WHERE (c.challenger_id = u.id OR c.challengee_id = u.id)
          AND c.created_at <= u.created_at + INTERVAL '14 days'
      )
        AND u.created_at < NOW() - INTERVAL '30 days'
    )
    SELECT
      (SELECT COUNT(*)::int FROM early_challengers) AS did_it,
      (SELECT COUNT(*) FILTER (WHERE is_asb)::int FROM early_challengers) AS did_it_asb,
      (SELECT COUNT(*)::int FROM non_challengers) AS didnt_do_it,
      (SELECT COUNT(*) FILTER (WHERE is_asb)::int FROM non_challengers) AS didnt_do_it_asb
  `);

  const ch = (challengesResult.rows?.[0] ?? challengesResult) as Record<string, number>;
  if (ch.did_it > 0 && ch.didnt_do_it > 0) {
    const rateWith = ch.did_it_asb / ch.did_it;
    const rateWithout = ch.didnt_do_it_asb / ch.didnt_do_it;
    const lift = rateWithout > 0 ? rateWith / rateWithout : rateWith > 0 ? 10 : 1;
    candidates.push({
      action: 'Created or accepted H2H challenge within 14 days',
      usersWhoDidIt: ch.did_it,
      asbRate: rateWith,
      usersWhoDidntDoIt: ch.didnt_do_it,
      asbRateWithout: rateWithout,
      liftMultiplier: lift,
      correlationStrength: lift >= 3 ? 'strong' : lift >= 1.5 ? 'moderate' : 'weak',
    });
  }

  // Sort by lift multiplier (strongest predictor first)
  candidates.sort((a, b) => b.liftMultiplier - a.liftMultiplier);

  // Store top aha moment as a belief
  if (candidates.length > 0) {
    const top = candidates[0];
    await upsertBelief(
      'aha_moment.top_predictor',
      top.liftMultiplier,
      top.usersWhoDidIt + top.usersWhoDidntDoIt,
      `"${top.action}" → ${Math.round(top.asbRate * 100)}% ASB rate vs ${Math.round(top.asbRateWithout * 100)}% without (${top.liftMultiplier.toFixed(1)}x lift)`,
    );
  }

  return candidates;
}
