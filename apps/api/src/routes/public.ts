import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users, gammblerScores, bets, capperProfiles, badges, follows } from '../db/schema';
import { eq, and, desc, sql, count, avg, ne } from 'drizzle-orm';

const router = Router();

// ---------- helpers ----------

const SPORTS = ['overall', 'nfl', 'nba', 'mlb', 'nhl', 'cfb', 'cbb', 'soccer'] as const;

function isValidSport(s: string): boolean {
  return (SPORTS as readonly string[]).includes(s);
}

function tierFromScore(score: number): string {
  if (score >= 90) return 'Legend';
  if (score >= 75) return 'Elite';
  if (score >= 60) return 'Veteran';
  if (score >= 40) return 'Contender';
  return 'Rookie';
}

// ---------- GET /api/public/leaderboard/:sport ----------

router.get('/leaderboard/:sport', async (req: Request, res: Response): Promise<void> => {
  try {
    const sport = req.params.sport;
    if (!isValidSport(sport)) {
      res.status(400).json({ error: 'Invalid sport' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 50;
    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        username: users.username,
        avatar_url: users.avatar_url,
        score: gammblerScores.score,
        win_rate: gammblerScores.win_rate,
        roi: gammblerScores.roi,
        settled_bet_count: gammblerScores.settled_bet_count,
      })
      .from(gammblerScores)
      .innerJoin(users, eq(users.id, gammblerScores.user_id))
      .where(
        and(
          eq(gammblerScores.sport, sport as any),
          eq(gammblerScores.is_unlocked, true),
          eq(users.is_profile_public, true)
        )
      )
      .orderBy(desc(gammblerScores.score))
      .limit(limit)
      .offset(offset);

    const [totalRow] = await db
      .select({ total: count() })
      .from(gammblerScores)
      .innerJoin(users, eq(users.id, gammblerScores.user_id))
      .where(
        and(
          eq(gammblerScores.sport, sport as any),
          eq(gammblerScores.is_unlocked, true),
          eq(users.is_profile_public, true)
        )
      );

    const leaderboard = rows.map((r, i) => ({
      rank: offset + i + 1,
      username: r.username,
      avatar_url: r.avatar_url,
      score: parseFloat(r.score),
      tier: tierFromScore(parseFloat(r.score)),
      win_rate: r.win_rate ? parseFloat(r.win_rate) : null,
      roi: r.roi ? parseFloat(r.roi) : null,
      settled_bet_count: r.settled_bet_count,
    }));

    res.json({
      sport,
      page,
      total: totalRow?.total ?? 0,
      total_pages: Math.ceil((totalRow?.total ?? 0) / limit),
      leaderboard,
    });
  } catch (err) {
    console.error('Public leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- GET /api/public/profile/:username ----------

router.get('/profile/:username', async (req: Request, res: Response): Promise<void> => {
  try {
    const username = req.params.username;

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        avatar_url: users.avatar_url,
        created_at: users.created_at,
        is_profile_public: users.is_profile_public,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user || !user.is_profile_public) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const scores = await db
      .select({
        sport: gammblerScores.sport,
        score: gammblerScores.score,
        win_rate: gammblerScores.win_rate,
        roi: gammblerScores.roi,
        settled_bet_count: gammblerScores.settled_bet_count,
        is_unlocked: gammblerScores.is_unlocked,
      })
      .from(gammblerScores)
      .where(eq(gammblerScores.user_id, user.id));

    const overallScore = scores.find(s => s.sport === 'overall');
    if (!overallScore?.is_unlocked) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const userBadges = await db
      .select({ badge_type: badges.badge_type, earned_at: badges.earned_at })
      .from(badges)
      .where(eq(badges.user_id, user.id));

    // record
    const [record] = await db
      .select({
        wins: sql<number>`count(*) filter (where ${bets.result} = 'won')`,
        losses: sql<number>`count(*) filter (where ${bets.result} = 'lost')`,
        pushes: sql<number>`count(*) filter (where ${bets.result} = 'push')`,
      })
      .from(bets)
      .where(eq(bets.user_id, user.id));

    // national rank
    const [rankRow] = await db
      .select({
        rank: sql<number>`(select count(*) + 1 from gammbler_scores gs2 inner join users u2 on u2.id = gs2.user_id where gs2.sport = 'overall' and gs2.is_unlocked = true and u2.is_profile_public = true and gs2.score > ${gammblerScores.score})`,
      })
      .from(gammblerScores)
      .where(
        and(
          eq(gammblerScores.user_id, user.id),
          eq(gammblerScores.sport, 'overall' as any)
        )
      );

    const [followerCount] = await db
      .select({ total: count() })
      .from(follows)
      .where(eq(follows.following_id, user.id));

    res.json({
      username: user.username,
      avatar_url: user.avatar_url,
      member_since: user.created_at,
      overall_score: parseFloat(overallScore.score),
      tier: tierFromScore(parseFloat(overallScore.score)),
      national_rank: rankRow?.rank ?? null,
      record: {
        wins: record?.wins ?? 0,
        losses: record?.losses ?? 0,
        pushes: record?.pushes ?? 0,
      },
      roi: overallScore.roi ? parseFloat(overallScore.roi) : null,
      win_rate: overallScore.win_rate ? parseFloat(overallScore.win_rate) : null,
      followers: followerCount?.total ?? 0,
      scores: scores
        .filter(s => s.is_unlocked)
        .map(s => ({
          sport: s.sport,
          score: parseFloat(s.score),
          tier: tierFromScore(parseFloat(s.score)),
          win_rate: s.win_rate ? parseFloat(s.win_rate) : null,
          roi: s.roi ? parseFloat(s.roi) : null,
          settled_bet_count: s.settled_bet_count,
        })),
      badges: userBadges.map(b => ({
        badge_type: b.badge_type,
        earned_at: b.earned_at,
      })),
    });
  } catch (err) {
    console.error('Public profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- GET /api/public/creators ----------

router.get('/creators', async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select({
        username: users.username,
        avatar_url: users.avatar_url,
        display_name: capperProfiles.display_name,
        bio: capperProfiles.bio,
        verified_score: capperProfiles.verified_score,
        favorite_sports: capperProfiles.favorite_sports,
        total_subscribers: capperProfiles.total_subscribers,
        total_followers: capperProfiles.total_followers,
      })
      .from(capperProfiles)
      .innerJoin(users, eq(users.id, capperProfiles.user_id))
      .where(
        and(
          eq(capperProfiles.status, 'active' as any),
          eq(users.is_profile_public, true)
        )
      )
      .orderBy(desc(capperProfiles.total_subscribers));

    res.json({
      total: rows.length,
      creators: rows.map(r => ({
        username: r.username,
        avatar_url: r.avatar_url,
        display_name: r.display_name,
        bio: r.bio,
        verified_score: r.verified_score ? parseFloat(r.verified_score) : null,
        favorite_sports: r.favorite_sports,
        total_subscribers: r.total_subscribers,
        total_followers: r.total_followers,
      })),
    });
  } catch (err) {
    console.error('Public creators error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- GET /api/public/creator/:username ----------

router.get('/creator/:username', async (req: Request, res: Response): Promise<void> => {
  try {
    const username = req.params.username;

    const [row] = await db
      .select({
        user_id: users.id,
        username: users.username,
        avatar_url: users.avatar_url,
        display_name: capperProfiles.display_name,
        bio: capperProfiles.bio,
        verified_score: capperProfiles.verified_score,
        favorite_sports: capperProfiles.favorite_sports,
        favorite_teams: capperProfiles.favorite_teams,
        betting_style: capperProfiles.betting_style,
        social_links: capperProfiles.social_links,
        total_subscribers: capperProfiles.total_subscribers,
        total_followers: capperProfiles.total_followers,
        total_tails: capperProfiles.total_tails,
        banner_url: capperProfiles.banner_url,
        profile_photo_url: capperProfiles.profile_photo_url,
        status: capperProfiles.status,
      })
      .from(capperProfiles)
      .innerJoin(users, eq(users.id, capperProfiles.user_id))
      .where(
        and(
          eq(users.username, username),
          eq(users.is_profile_public, true)
        )
      )
      .limit(1);

    if (!row || row.status !== 'active') {
      res.status(404).json({ error: 'Creator not found' });
      return;
    }

    // get creator's scores
    const scores = await db
      .select({
        sport: gammblerScores.sport,
        score: gammblerScores.score,
        win_rate: gammblerScores.win_rate,
        roi: gammblerScores.roi,
        settled_bet_count: gammblerScores.settled_bet_count,
        is_unlocked: gammblerScores.is_unlocked,
      })
      .from(gammblerScores)
      .where(eq(gammblerScores.user_id, row.user_id));

    const [record] = await db
      .select({
        wins: sql<number>`count(*) filter (where ${bets.result} = 'won')`,
        losses: sql<number>`count(*) filter (where ${bets.result} = 'lost')`,
        pushes: sql<number>`count(*) filter (where ${bets.result} = 'push')`,
      })
      .from(bets)
      .where(eq(bets.user_id, row.user_id));

    res.json({
      username: row.username,
      avatar_url: row.avatar_url,
      display_name: row.display_name,
      bio: row.bio,
      banner_url: row.banner_url,
      profile_photo_url: row.profile_photo_url,
      verified_score: row.verified_score ? parseFloat(row.verified_score) : null,
      favorite_sports: row.favorite_sports,
      favorite_teams: row.favorite_teams,
      betting_style: row.betting_style,
      social_links: row.social_links,
      total_subscribers: row.total_subscribers,
      total_followers: row.total_followers,
      total_tails: row.total_tails,
      record: {
        wins: record?.wins ?? 0,
        losses: record?.losses ?? 0,
        pushes: record?.pushes ?? 0,
      },
      scores: scores
        .filter(s => s.is_unlocked)
        .map(s => ({
          sport: s.sport,
          score: parseFloat(s.score),
          tier: tierFromScore(parseFloat(s.score)),
          win_rate: s.win_rate ? parseFloat(s.win_rate) : null,
          roi: s.roi ? parseFloat(s.roi) : null,
          settled_bet_count: s.settled_bet_count,
        })),
    });
  } catch (err) {
    console.error('Public creator error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- GET /api/public/stats ----------

router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    // total users with public profiles
    const [userCount] = await db
      .select({ total: count() })
      .from(users)
      .where(eq(users.is_profile_public, true));

    // total bets
    const [betCount] = await db
      .select({ total: count() })
      .from(bets);

    // total settled bets
    const [settledCount] = await db
      .select({ total: count() })
      .from(bets)
      .where(ne(bets.result, 'pending' as any));

    // avg score, win rate, roi across unlocked public users (overall sport)
    const [avgMetrics] = await db
      .select({
        avg_score: avg(gammblerScores.score),
        avg_win_rate: avg(gammblerScores.win_rate),
        avg_roi: avg(gammblerScores.roi),
        scored_users: count(),
      })
      .from(gammblerScores)
      .innerJoin(users, eq(users.id, gammblerScores.user_id))
      .where(
        and(
          eq(gammblerScores.sport, 'overall' as any),
          eq(gammblerScores.is_unlocked, true),
          eq(users.is_profile_public, true)
        )
      );

    // score distribution (buckets of 10)
    const distribution = await db
      .select({
        bucket: sql<string>`(floor(${gammblerScores.score}::numeric / 10) * 10)::int || '-' || (floor(${gammblerScores.score}::numeric / 10) * 10 + 9)::int`,
        bucket_floor: sql<number>`floor(${gammblerScores.score}::numeric / 10) * 10`,
        count: count(),
      })
      .from(gammblerScores)
      .innerJoin(users, eq(users.id, gammblerScores.user_id))
      .where(
        and(
          eq(gammblerScores.sport, 'overall' as any),
          eq(gammblerScores.is_unlocked, true),
          eq(users.is_profile_public, true)
        )
      )
      .groupBy(sql`floor(${gammblerScores.score}::numeric / 10)`)
      .orderBy(sql`floor(${gammblerScores.score}::numeric / 10)`);

    // profitable bettors (ROI > 0)
    const [profitableCount] = await db
      .select({ total: count() })
      .from(gammblerScores)
      .innerJoin(users, eq(users.id, gammblerScores.user_id))
      .where(
        and(
          eq(gammblerScores.sport, 'overall' as any),
          eq(gammblerScores.is_unlocked, true),
          eq(users.is_profile_public, true),
          sql`${gammblerScores.roi}::numeric > 0`
        )
      );

    // sport breakdown
    const sportStats = await db
      .select({
        sport: gammblerScores.sport,
        avg_score: avg(gammblerScores.score),
        avg_win_rate: avg(gammblerScores.win_rate),
        avg_roi: avg(gammblerScores.roi),
        total_scored: count(),
      })
      .from(gammblerScores)
      .innerJoin(users, eq(users.id, gammblerScores.user_id))
      .where(
        and(
          eq(gammblerScores.is_unlocked, true),
          eq(users.is_profile_public, true),
          ne(gammblerScores.sport, 'overall' as any)
        )
      )
      .groupBy(gammblerScores.sport)
      .orderBy(desc(count()));

    // bet type distribution
    const betTypes = await db
      .select({
        bet_type: bets.bet_type,
        total: count(),
      })
      .from(bets)
      .groupBy(bets.bet_type)
      .orderBy(desc(count()));

    const totalScored = avgMetrics?.scored_users ?? 0;
    const totalProfitable = profitableCount?.total ?? 0;

    res.json({
      total_users: userCount?.total ?? 0,
      total_bets: betCount?.total ?? 0,
      total_settled_bets: settledCount?.total ?? 0,
      scored_users: totalScored,
      avg_score: avgMetrics?.avg_score ? parseFloat(avgMetrics.avg_score) : null,
      avg_win_rate: avgMetrics?.avg_win_rate ? parseFloat(avgMetrics.avg_win_rate) : null,
      avg_roi: avgMetrics?.avg_roi ? parseFloat(avgMetrics.avg_roi) : null,
      profitable_bettors: totalProfitable,
      profitable_percentage: totalScored > 0 ? parseFloat(((totalProfitable / totalScored) * 100).toFixed(1)) : null,
      score_distribution: distribution.map(d => ({
        range: d.bucket,
        count: d.count,
      })),
      sport_breakdown: sportStats.map(s => ({
        sport: s.sport,
        avg_score: s.avg_score ? parseFloat(s.avg_score) : null,
        avg_win_rate: s.avg_win_rate ? parseFloat(s.avg_win_rate) : null,
        avg_roi: s.avg_roi ? parseFloat(s.avg_roi) : null,
        total_scored: s.total_scored,
      })),
      bet_type_distribution: betTypes.map(b => ({
        bet_type: b.bet_type,
        total: b.total,
      })),
    });
  } catch (err) {
    console.error('Public stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- GET /api/public/stats/:sport ----------

router.get('/stats/:sport', async (req: Request, res: Response): Promise<void> => {
  try {
    const sport = req.params.sport;
    if (!isValidSport(sport) || sport === 'overall') {
      res.status(400).json({ error: 'Invalid sport' });
      return;
    }

    const [metrics] = await db
      .select({
        avg_score: avg(gammblerScores.score),
        avg_win_rate: avg(gammblerScores.win_rate),
        avg_roi: avg(gammblerScores.roi),
        total_scored: count(),
      })
      .from(gammblerScores)
      .innerJoin(users, eq(users.id, gammblerScores.user_id))
      .where(
        and(
          eq(gammblerScores.sport, sport as any),
          eq(gammblerScores.is_unlocked, true),
          eq(users.is_profile_public, true)
        )
      );

    // total bets for this sport
    const [sportBets] = await db
      .select({ total: count() })
      .from(bets)
      .where(eq(bets.sport, sport as any));

    // bet type distribution for this sport
    const betTypes = await db
      .select({
        bet_type: bets.bet_type,
        total: count(),
      })
      .from(bets)
      .where(eq(bets.sport, sport as any))
      .groupBy(bets.bet_type)
      .orderBy(desc(count()));

    // top 10 performers
    const top10 = await db
      .select({
        username: users.username,
        score: gammblerScores.score,
        win_rate: gammblerScores.win_rate,
        roi: gammblerScores.roi,
        settled_bet_count: gammblerScores.settled_bet_count,
      })
      .from(gammblerScores)
      .innerJoin(users, eq(users.id, gammblerScores.user_id))
      .where(
        and(
          eq(gammblerScores.sport, sport as any),
          eq(gammblerScores.is_unlocked, true),
          eq(users.is_profile_public, true)
        )
      )
      .orderBy(desc(gammblerScores.score))
      .limit(10);

    // profitable in this sport
    const [profitableCount] = await db
      .select({ total: count() })
      .from(gammblerScores)
      .innerJoin(users, eq(users.id, gammblerScores.user_id))
      .where(
        and(
          eq(gammblerScores.sport, sport as any),
          eq(gammblerScores.is_unlocked, true),
          eq(users.is_profile_public, true),
          sql`${gammblerScores.roi}::numeric > 0`
        )
      );

    const totalScored = metrics?.total_scored ?? 0;
    const totalProfitable = profitableCount?.total ?? 0;

    res.json({
      sport,
      total_bets: sportBets?.total ?? 0,
      scored_users: totalScored,
      avg_score: metrics?.avg_score ? parseFloat(metrics.avg_score) : null,
      avg_win_rate: metrics?.avg_win_rate ? parseFloat(metrics.avg_win_rate) : null,
      avg_roi: metrics?.avg_roi ? parseFloat(metrics.avg_roi) : null,
      profitable_bettors: totalProfitable,
      profitable_percentage: totalScored > 0 ? parseFloat(((totalProfitable / totalScored) * 100).toFixed(1)) : null,
      bet_type_distribution: betTypes.map(b => ({
        bet_type: b.bet_type,
        total: b.total,
      })),
      top_performers: top10.map((r, i) => ({
        rank: i + 1,
        username: r.username,
        score: parseFloat(r.score),
        tier: tierFromScore(parseFloat(r.score)),
        win_rate: r.win_rate ? parseFloat(r.win_rate) : null,
        roi: r.roi ? parseFloat(r.roi) : null,
        settled_bet_count: r.settled_bet_count,
      })),
    });
  } catch (err) {
    console.error('Public sport stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- GET /api/public/sitemap-data ----------
// Returns usernames for dynamic sitemap generation

router.get('/sitemap-data', async (_req: Request, res: Response): Promise<void> => {
  try {
    // public users with unlocked scores
    const publicUsers = await db
      .select({ username: users.username })
      .from(users)
      .innerJoin(gammblerScores, and(
        eq(gammblerScores.user_id, users.id),
        eq(gammblerScores.sport, 'overall' as any),
        eq(gammblerScores.is_unlocked, true)
      ))
      .where(eq(users.is_profile_public, true));

    // active creators
    const activeCreators = await db
      .select({ username: users.username })
      .from(capperProfiles)
      .innerJoin(users, eq(users.id, capperProfiles.user_id))
      .where(
        and(
          eq(capperProfiles.status, 'active' as any),
          eq(users.is_profile_public, true)
        )
      );

    res.json({
      public_usernames: publicUsers.map(u => u.username),
      creator_usernames: activeCreators.map(c => c.username),
    });
  } catch (err) {
    console.error('Sitemap data error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
