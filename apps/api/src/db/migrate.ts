import { Pool } from 'pg';
import { env } from '../config/env';

const useSSL = env.NODE_ENV === 'production' && env.DATABASE_URL.includes('.render.com');
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create enums
    const enums = [
      `DO $$ BEGIN CREATE TYPE subscription_status AS ENUM ('trialing','active','past_due','cancelled','paused'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE bet_result AS ENUM ('win','loss','push','pending','void'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE sport AS ENUM ('overall','nfl','nba','mlb','nhl','cfb','cbb','soccer','prizepicks','dfs'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE platform AS ENUM ('draftkings','fanduel','betmgm','caesars','espn_bet','pointsbet','wynnbet','prizepicks','underdog','espn_fantasy','yahoo_fantasy','other'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE bet_type AS ENUM ('spread','moneyline','over_under','parlay','prop','player_prop','teaser','futures','other'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE badge_type AS ENUM ('first_win','sharp_shooter','elite_status','legend','profitable_month','profitable_quarter','consistent','hot_streak','on_fire','unstoppable','nfl_sharp','nba_sharp','mlb_sharp','nhl_sharp','cfb_sharp','cbb_sharp','connected','all_in','diversified','veteran'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE feed_event_type AS ENUM ('parlay_hit','rank_up','win_streak','badge_earned','score_high','sportsbook_connected','weekly_leader'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE notification_type AS ENUM ('trial_ending_10','trial_ending_13','trial_ended','weekly_report','badge_earned','leaderboard_passed','score_change','bet_settled','new_follower'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    ];

    for (const sql of enums) {
      await client.query(sql);
    }

    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(30) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        trial_ends_at TIMESTAMPTZ NOT NULL,
        subscription_status subscription_status NOT NULL DEFAULT 'trialing',
        stripe_customer_id VARCHAR(255),
        is_profile_public BOOLEAN NOT NULL DEFAULT true,
        tos_accepted_at TIMESTAMPTZ,
        referral_code VARCHAR(20) UNIQUE,
        referred_by UUID,
        notification_preferences JSONB DEFAULT '{}',
        do_not_disturb_start VARCHAR(5),
        do_not_disturb_end VARCHAR(5)
      );
      CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
      CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform platform NOT NULL,
        sport sport NOT NULL,
        league VARCHAR(50),
        bet_type bet_type NOT NULL,
        selection TEXT NOT NULL,
        odds NUMERIC(10,4) NOT NULL,
        stake NUMERIC(12,2) NOT NULL,
        result bet_result NOT NULL DEFAULT 'pending',
        profit_loss NUMERIC(12,2) DEFAULT 0,
        settled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        is_manual BOOLEAN NOT NULL DEFAULT false,
        opening_odds NUMERIC(10,4),
        closing_odds NUMERIC(10,4),
        sharpsports_bet_id VARCHAR(255),
        event_name TEXT,
        parlay_legs INTEGER
      );
      CREATE INDEX IF NOT EXISTS bets_user_id_idx ON bets(user_id);
      CREATE INDEX IF NOT EXISTS bets_sport_idx ON bets(sport);
      CREATE INDEX IF NOT EXISTS bets_result_idx ON bets(result);
      CREATE INDEX IF NOT EXISTS bets_settled_at_idx ON bets(settled_at);
      CREATE INDEX IF NOT EXISTS bets_user_sport_idx ON bets(user_id, sport);
      CREATE INDEX IF NOT EXISTS bets_platform_idx ON bets(platform);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS gammbler_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sport sport NOT NULL,
        score NUMERIC(5,1) NOT NULL DEFAULT 0,
        win_rate NUMERIC(7,4) DEFAULT 0,
        roi NUMERIC(10,4) DEFAULT 0,
        clv NUMERIC(7,4) DEFAULT 0,
        stake_consistency NUMERIC(7,4) DEFAULT 0,
        volume_score NUMERIC(7,4) DEFAULT 0,
        diversity_score NUMERIC(7,4) DEFAULT 0,
        settled_bet_count INTEGER NOT NULL DEFAULT 0,
        is_unlocked BOOLEAN NOT NULL DEFAULT false,
        calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        previous_score NUMERIC(5,1),
        score_change_today NUMERIC(5,1) DEFAULT 0,
        UNIQUE(user_id, sport)
      );
      CREATE INDEX IF NOT EXISTS scores_score_idx ON gammbler_scores(score);
      CREATE INDEX IF NOT EXISTS scores_sport_idx ON gammbler_scores(sport);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS follows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(follower_id, following_id)
      );
      CREATE INDEX IF NOT EXISTS follows_follower_idx ON follows(follower_id);
      CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS badges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_type badge_type NOT NULL,
        earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, badge_type)
      );
      CREATE INDEX IF NOT EXISTS badges_user_idx ON badges(user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS feed_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type feed_event_type NOT NULL,
        event_data JSONB NOT NULL DEFAULT '{}',
        sport sport,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS feed_events_created_at_idx ON feed_events(created_at);
      CREATE INDEX IF NOT EXISTS feed_events_user_idx ON feed_events(user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS feed_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL REFERENCES feed_events(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, event_id)
      );
      CREATE INDEX IF NOT EXISTS feed_likes_event_idx ON feed_likes(event_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS feed_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL REFERENCES feed_events(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS feed_comments_event_idx ON feed_comments(event_id);
      CREATE INDEX IF NOT EXISTS feed_comments_user_idx ON feed_comments(user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type notification_type NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS notifications_read_idx ON notifications(user_id, read);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sportsbook_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform platform NOT NULL,
        sharpsports_account_id VARCHAR(255),
        connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_synced_at TIMESTAMPTZ,
        is_csv_import BOOLEAN NOT NULL DEFAULT false,
        UNIQUE(user_id, platform)
      );
      CREATE INDEX IF NOT EXISTS connections_user_idx ON sportsbook_connections(user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS leaderboard_seasons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sport sport NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        champion_user_id UUID REFERENCES users(id),
        started_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ,
        UNIQUE(sport, month, year)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_start TIMESTAMPTZ NOT NULL,
        week_end TIMESTAMPTZ NOT NULL,
        record_wins INTEGER NOT NULL DEFAULT 0,
        record_losses INTEGER NOT NULL DEFAULT 0,
        record_pushes INTEGER NOT NULL DEFAULT 0,
        score_change NUMERIC(5,1),
        biggest_win NUMERIC(12,2),
        biggest_loss NUMERIC(12,2),
        insight TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, week_start)
      );
    `);

    // League enums
    const leagueEnums = [
      `DO $$ BEGIN CREATE TYPE league_status AS ENUM ('active','completed','archived'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE league_sport AS ENUM ('all','nfl','nba','mlb','nhl','cfb','cbb','soccer','mma'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE league_member_role AS ENUM ('commissioner','member'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    ];
    for (const sql of leagueEnums) {
      await client.query(sql);
    }

    // Leagues tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS leagues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        sport league_sport NOT NULL,
        status league_status NOT NULL DEFAULT 'active',
        commissioner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invite_code VARCHAR(20) NOT NULL UNIQUE,
        min_bets_per_week INTEGER NOT NULL DEFAULT 1,
        min_active_weeks_pct INTEGER NOT NULL DEFAULT 75,
        season_name VARCHAR(100),
        season_start TIMESTAMPTZ NOT NULL,
        season_end TIMESTAMPTZ NOT NULL,
        max_members INTEGER NOT NULL DEFAULT 20,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS leagues_commissioner_idx ON leagues(commissioner_id);
      CREATE INDEX IF NOT EXISTS leagues_invite_code_idx ON leagues(invite_code);
      CREATE INDEX IF NOT EXISTS leagues_status_idx ON leagues(status);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS league_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role league_member_role NOT NULL DEFAULT 'member',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        season_score NUMERIC(5,1) NOT NULL DEFAULT 0,
        active_weeks INTEGER NOT NULL DEFAULT 0,
        total_weeks INTEGER NOT NULL DEFAULT 0,
        total_bets_in_league INTEGER NOT NULL DEFAULT 0,
        best_week_score NUMERIC(5,1) DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        UNIQUE(league_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS league_members_league_idx ON league_members(league_id);
      CREATE INDEX IF NOT EXISTS league_members_user_idx ON league_members(user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS league_weekly_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_number INTEGER NOT NULL,
        week_start TIMESTAMPTZ NOT NULL,
        week_end TIMESTAMPTZ NOT NULL,
        score NUMERIC(5,1) NOT NULL DEFAULT 0,
        bets_placed INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        pushes INTEGER NOT NULL DEFAULT 0,
        roi NUMERIC(10,4) DEFAULT 0,
        met_minimum BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(league_id, user_id, week_number)
      );
      CREATE INDEX IF NOT EXISTS league_weekly_league_week_idx ON league_weekly_scores(league_id, week_number);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS league_awards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        award_type VARCHAR(50) NOT NULL,
        award_name VARCHAR(100) NOT NULL,
        description TEXT,
        awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS league_awards_league_idx ON league_awards(league_id);
      CREATE INDEX IF NOT EXISTS league_awards_user_idx ON league_awards(user_id);
    `);

    // ── Bet Slips (Live Bet Slip Sharing) ──────────────────────
    const slipEnums = [
      `DO $$ BEGIN CREATE TYPE bet_slip_status AS ENUM ('live','won','lost','pushed','void'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE slip_reaction_type AS ENUM ('fire','skull','money','clown','goat'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    ];
    for (const sql of slipEnums) {
      await client.query(sql);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS bet_slips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bet_id UUID REFERENCES bets(id) ON DELETE SET NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        sport sport NOT NULL,
        bet_type bet_type NOT NULL,
        selection TEXT NOT NULL,
        odds NUMERIC(10,4) NOT NULL,
        stake NUMERIC(12,2) NOT NULL,
        platform platform NOT NULL,
        status bet_slip_status NOT NULL DEFAULT 'live',
        event_name TEXT,
        parlay_legs INTEGER,
        profit_loss NUMERIC(12,2),
        views_count INTEGER NOT NULL DEFAULT 0,
        shares_count INTEGER NOT NULL DEFAULT 0,
        is_public BOOLEAN NOT NULL DEFAULT true,
        shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        settled_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS bet_slips_user_idx ON bet_slips(user_id);
      CREATE INDEX IF NOT EXISTS bet_slips_status_idx ON bet_slips(status);
      CREATE INDEX IF NOT EXISTS bet_slips_shared_at_idx ON bet_slips(shared_at);
      CREATE INDEX IF NOT EXISTS bet_slips_sport_idx ON bet_slips(sport);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bet_slip_reactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slip_id UUID NOT NULL REFERENCES bet_slips(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reaction slip_reaction_type NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(slip_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS slip_reactions_slip_idx ON bet_slip_reactions(slip_id);
    `);

    // ── Capper Marketplace (Tail This) ──────────────────────────
    const capperEnums = [
      `DO $$ BEGIN CREATE TYPE capper_status AS ENUM ('pending','active','suspended'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
      `DO $$ BEGIN CREATE TYPE capper_sub_status AS ENUM ('active','cancelled','expired'); EXCEPTION WHEN duplicate_object THEN null; END $$`,
    ];
    for (const sql of capperEnums) {
      await client.query(sql);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS capper_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        display_name VARCHAR(100) NOT NULL,
        bio TEXT,
        price_cents INTEGER NOT NULL DEFAULT 499,
        status capper_status NOT NULL DEFAULT 'active',
        total_subscribers INTEGER NOT NULL DEFAULT 0,
        total_tails INTEGER NOT NULL DEFAULT 0,
        total_earnings_cents INTEGER NOT NULL DEFAULT 0,
        verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        verified_score NUMERIC(5,1) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS capper_profiles_user_idx ON capper_profiles(user_id);
      CREATE INDEX IF NOT EXISTS capper_profiles_status_idx ON capper_profiles(status);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS capper_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        capper_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscriber_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status capper_sub_status NOT NULL DEFAULT 'active',
        price_cents INTEGER NOT NULL,
        stripe_subscription_id VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        UNIQUE(capper_user_id, subscriber_user_id)
      );
      CREATE INDEX IF NOT EXISTS capper_sub_capper_idx ON capper_subscriptions(capper_user_id);
      CREATE INDEX IF NOT EXISTS capper_sub_subscriber_idx ON capper_subscriptions(subscriber_user_id);
      CREATE INDEX IF NOT EXISTS capper_sub_status_idx ON capper_subscriptions(status);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tail_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slip_id UUID NOT NULL REFERENCES bet_slips(id) ON DELETE CASCADE,
        capper_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tailer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS tail_events_slip_idx ON tail_events(slip_id);
      CREATE INDEX IF NOT EXISTS tail_events_capper_idx ON tail_events(capper_user_id);
      CREATE INDEX IF NOT EXISTS tail_events_tailer_idx ON tail_events(tailer_user_id);
    `);

    // ── Cash Leagues (extend existing leagues table) ────────────
    await client.query(`
      ALTER TABLE leagues ADD COLUMN IF NOT EXISTS is_cash_league BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE leagues ADD COLUMN IF NOT EXISTS buy_in_cents INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE leagues ADD COLUMN IF NOT EXISTS rake_pct INTEGER NOT NULL DEFAULT 10;
      ALTER TABLE leagues ADD COLUMN IF NOT EXISTS prize_pool_cents INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE leagues ADD COLUMN IF NOT EXISTS payout_status VARCHAR(20) DEFAULT 'pending';
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS league_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        buy_in_paid_cents INTEGER NOT NULL,
        payout_cents INTEGER NOT NULL DEFAULT 0,
        stripe_payment_id VARCHAR(255),
        paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        payout_at TIMESTAMPTZ,
        UNIQUE(league_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS league_entries_league_idx ON league_entries(league_id);
      CREATE INDEX IF NOT EXISTS league_entries_user_idx ON league_entries(user_id);
    `);

    // ── Pre-Game Lock System: add event_start_time, is_pregame_verified, odds_api_event_id to bets ──
    await client.query(`
      ALTER TABLE bets ADD COLUMN IF NOT EXISTS event_start_time TIMESTAMPTZ;
      ALTER TABLE bets ADD COLUMN IF NOT EXISTS is_pregame_verified BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE bets ADD COLUMN IF NOT EXISTS odds_api_event_id VARCHAR(255);
    `);

    // ── Score Card Generations (monthly tracking for free users) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS score_card_generations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sport sport NOT NULL,
        generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS score_card_gen_user_idx ON score_card_generations(user_id);
      CREATE INDEX IF NOT EXISTS score_card_gen_date_idx ON score_card_generations(generated_at);
    `);

    // ── Score Snapshots (historical Gammbler Score tracking) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS score_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sport sport NOT NULL,
        score NUMERIC(5,1) NOT NULL,
        snapshot_date TIMESTAMPTZ NOT NULL,
        UNIQUE(user_id, sport, snapshot_date)
      );
      CREATE INDEX IF NOT EXISTS score_snapshots_user_idx ON score_snapshots(user_id);
      CREATE INDEX IF NOT EXISTS score_snapshots_date_idx ON score_snapshots(snapshot_date);
    `);

    // ── Head-to-Head Challenges ──
    await client.query(`
      DO $$ BEGIN CREATE TYPE challenge_status AS ENUM ('pending','accepted','declined','settled','cancelled','expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // Add new badge types
    await client.query(`
      DO $$ BEGIN
        ALTER TYPE badge_type ADD VALUE IF NOT EXISTS 'h2h_first_win';
        ALTER TYPE badge_type ADD VALUE IF NOT EXISTS 'h2h_streak_3';
        ALTER TYPE badge_type ADD VALUE IF NOT EXISTS 'h2h_streak_5';
        ALTER TYPE badge_type ADD VALUE IF NOT EXISTS 'h2h_champion';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add new feed event types
    await client.query(`
      DO $$ BEGIN
        ALTER TYPE feed_event_type ADD VALUE IF NOT EXISTS 'h2h_challenge';
        ALTER TYPE feed_event_type ADD VALUE IF NOT EXISTS 'h2h_result';
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS challenges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        challenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        challengee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sport sport NOT NULL,
        event_name TEXT NOT NULL,
        event_start_time TIMESTAMPTZ,
        challenger_pick TEXT NOT NULL,
        challengee_pick TEXT,
        status challenge_status NOT NULL DEFAULT 'pending',
        winner_id UUID REFERENCES users(id),
        message TEXT,
        stake_display VARCHAR(100),
        settled_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS challenges_challenger_idx ON challenges(challenger_id);
      CREATE INDEX IF NOT EXISTS challenges_challengee_idx ON challenges(challengee_id);
      CREATE INDEX IF NOT EXISTS challenges_status_idx ON challenges(status);
      CREATE INDEX IF NOT EXISTS challenges_winner_idx ON challenges(winner_id);
      CREATE INDEX IF NOT EXISTS challenges_sport_idx ON challenges(sport);
      CREATE INDEX IF NOT EXISTS challenges_expires_at_idx ON challenges(expires_at);
    `);

    // ── DFS (Daily Fantasy Sports) ──
    await client.query(`
      DO $$ BEGIN CREATE TYPE dfs_sport AS ENUM ('overall','nfl','nba','mlb','nhl','pga','nascar','soccer','mma','cfb','cbb'); EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN CREATE TYPE dfs_contest_type AS ENUM ('cash','gpp','h2h','fifty_fifty','multiplier','satellite','other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN CREATE TYPE dfs_platform AS ENUM ('draftkings','fanduel','yahoo','underdog','prizepicks','other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN CREATE TYPE dfs_badge_type AS ENUM ('dfs_first_cash','dfs_sharp','dfs_elite','dfs_legend','dfs_profitable_month','dfs_profitable_quarter','dfs_consistent','dfs_hot_streak','dfs_on_fire','dfs_unstoppable','dfs_nfl_sharp','dfs_nba_sharp','dfs_mlb_sharp','dfs_nhl_sharp','dfs_pga_sharp','dfs_nascar_sharp','dfs_gpp_winner','dfs_grinder','dfs_diversified'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS dfs_contests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform dfs_platform NOT NULL,
        sport dfs_sport NOT NULL,
        contest_type dfs_contest_type NOT NULL,
        contest_name TEXT,
        contest_id VARCHAR(255),
        entry_fee_cents INTEGER NOT NULL,
        payout_cents INTEGER NOT NULL DEFAULT 0,
        entries INTEGER,
        finish_position INTEGER,
        total_entries INTEGER,
        points_scored NUMERIC(10,2),
        is_manual BOOLEAN NOT NULL DEFAULT false,
        is_csv_import BOOLEAN NOT NULL DEFAULT false,
        contest_date TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS dfs_contests_user_idx ON dfs_contests(user_id);
      CREATE INDEX IF NOT EXISTS dfs_contests_sport_idx ON dfs_contests(sport);
      CREATE INDEX IF NOT EXISTS dfs_contests_type_idx ON dfs_contests(contest_type);
      CREATE INDEX IF NOT EXISTS dfs_contests_platform_idx ON dfs_contests(platform);
      CREATE INDEX IF NOT EXISTS dfs_contests_user_sport_idx ON dfs_contests(user_id, sport);
      CREATE INDEX IF NOT EXISTS dfs_contests_date_idx ON dfs_contests(contest_date);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS dfs_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sport dfs_sport NOT NULL,
        score NUMERIC(5,1) NOT NULL DEFAULT 0,
        roi NUMERIC(10,4) DEFAULT 0,
        cash_rate NUMERIC(7,4) DEFAULT 0,
        consistency NUMERIC(7,4) DEFAULT 0,
        volume_score NUMERIC(7,4) DEFAULT 0,
        diversity_score NUMERIC(7,4) DEFAULT 0,
        total_contests INTEGER NOT NULL DEFAULT 0,
        total_entry_fees_cents INTEGER NOT NULL DEFAULT 0,
        total_payouts_cents INTEGER NOT NULL DEFAULT 0,
        is_unlocked BOOLEAN NOT NULL DEFAULT false,
        calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        previous_score NUMERIC(5,1),
        score_change_today NUMERIC(5,1) DEFAULT 0,
        UNIQUE(user_id, sport)
      );
      CREATE INDEX IF NOT EXISTS dfs_scores_score_idx ON dfs_scores(score);
      CREATE INDEX IF NOT EXISTS dfs_scores_sport_idx ON dfs_scores(sport);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS dfs_score_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sport dfs_sport NOT NULL,
        score NUMERIC(5,1) NOT NULL,
        snapshot_date TIMESTAMPTZ NOT NULL,
        UNIQUE(user_id, sport, snapshot_date)
      );
      CREATE INDEX IF NOT EXISTS dfs_snapshots_user_idx ON dfs_score_snapshots(user_id);
      CREATE INDEX IF NOT EXISTS dfs_snapshots_date_idx ON dfs_score_snapshots(snapshot_date);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS dfs_badges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_type dfs_badge_type NOT NULL,
        earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, badge_type)
      );
      CREATE INDEX IF NOT EXISTS dfs_badges_user_idx ON dfs_badges(user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS dfs_csv_imports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform dfs_platform NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        rows_imported INTEGER NOT NULL DEFAULT 0,
        rows_skipped INTEGER NOT NULL DEFAULT 0,
        imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS dfs_csv_imports_user_idx ON dfs_csv_imports(user_id);
    `);

    // Add date_of_birth column to users
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(10);
    `);

    // ── Creator Profile Expansion ───────────────────────────────
    await client.query(`
      ALTER TABLE capper_profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
      ALTER TABLE capper_profiles ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
      ALTER TABLE capper_profiles ADD COLUMN IF NOT EXISTS favorite_sports JSONB DEFAULT '[]';
      ALTER TABLE capper_profiles ADD COLUMN IF NOT EXISTS favorite_teams JSONB DEFAULT '[]';
      ALTER TABLE capper_profiles ADD COLUMN IF NOT EXISTS betting_style VARCHAR(100);
      ALTER TABLE capper_profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
      ALTER TABLE capper_profiles ADD COLUMN IF NOT EXISTS total_followers INTEGER NOT NULL DEFAULT 0;
    `);

    // ── Creator Posts ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS creator_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        image_url TEXT,
        is_subscriber_only BOOLEAN NOT NULL DEFAULT false,
        like_count INTEGER NOT NULL DEFAULT 0,
        comment_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS creator_posts_user_idx ON creator_posts(user_id);
      CREATE INDEX IF NOT EXISTS creator_posts_created_at_idx ON creator_posts(created_at);
      CREATE INDEX IF NOT EXISTS creator_posts_sub_only_idx ON creator_posts(is_subscriber_only);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS creator_post_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, post_id)
      );
      CREATE INDEX IF NOT EXISTS creator_post_likes_post_idx ON creator_post_likes(post_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS creator_post_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES creator_posts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS creator_post_comments_post_idx ON creator_post_comments(post_id);
      CREATE INDEX IF NOT EXISTS creator_post_comments_user_idx ON creator_post_comments(user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS creator_badges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_id VARCHAR(50) NOT NULL,
        earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS creator_badges_user_badge_unique ON creator_badges(user_id, badge_id);
      CREATE INDEX IF NOT EXISTS creator_badges_user_idx ON creator_badges(user_id);
    `);

    // Verified Score Pass columns
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_score_pass BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_score_pass_purchased_at TIMESTAMPTZ;
    `);

    // Email verification + Password reset columns
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(64);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(64);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;
    `);

    // ══════════════════════════════════════════════════════════
    // GROWTH BRAIN — AI Chief Growth Officer
    // ══════════════════════════════════════════════════════════

    // User acquisition & activity tracking columns
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(200);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_context JSONB;
    `);

    // Creator acquisition source
    await client.query(`
      ALTER TABLE capper_profiles ADD COLUMN IF NOT EXISTS acquisition_source VARCHAR(100);
    `);

    // Growth Brain enums
    await client.query(`
      DO $$ BEGIN CREATE TYPE growth_action_type AS ENUM (
        'creator_outreach', 'onboarding_nudge', 'referral_campaign',
        'retention_campaign', 'seo_article', 'social_content',
        'community_reply', 'ai_discoverability_page'
      ); EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN CREATE TYPE growth_opportunity_status AS ENUM (
        'proposed', 'approved', 'rejected', 'executed', 'measuring', 'expired', 'completed'
      ); EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN CREATE TYPE outreach_target_status AS ENUM (
        'discovered', 'queued', 'contacted', 'replied', 'converted', 'declined', 'no_response'
      ); EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // Growth Beliefs — the Brain's memory
    await client.query(`
      CREATE TABLE IF NOT EXISTS growth_beliefs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        belief_key VARCHAR(200) NOT NULL UNIQUE,
        belief_value NUMERIC(12,6) NOT NULL,
        sample_size INTEGER NOT NULL DEFAULT 0,
        confidence NUMERIC(5,4) NOT NULL DEFAULT 0,
        previous_value NUMERIC(12,6),
        previous_sample_size INTEGER,
        updated_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS growth_beliefs_key_idx ON growth_beliefs(belief_key);
    `);

    // Growth Opportunities — candidate actions
    await client.query(`
      CREATE TABLE IF NOT EXISTS growth_opportunities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action_type growth_action_type NOT NULL,
        channel VARCHAR(50) NOT NULL,
        why_this TEXT NOT NULL,
        why_now TEXT NOT NULL,
        evidence JSONB NOT NULL DEFAULT '{}',
        expected_asbs NUMERIC(10,4) NOT NULL,
        p_success NUMERIC(7,6) NOT NULL,
        confidence NUMERIC(5,4) NOT NULL,
        urgency NUMERIC(5,2) NOT NULL DEFAULT 1.00,
        ev_score NUMERIC(12,6) NOT NULL,
        cost_dollars NUMERIC(10,2) DEFAULT 0,
        founder_time_minutes INTEGER DEFAULT 0,
        asbs_per_dollar NUMERIC(10,4),
        asbs_per_minute NUMERIC(10,6),
        success_criteria TEXT NOT NULL,
        learning_objective TEXT NOT NULL,
        content JSONB,
        target_type VARCHAR(50),
        target_id VARCHAR(255),
        target_metadata JSONB,
        status growth_opportunity_status NOT NULL DEFAULT 'proposed',
        rejection_reason TEXT,
        is_exploratory BOOLEAN NOT NULL DEFAULT false,
        measurement_window_days INTEGER NOT NULL DEFAULT 30,
        proposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        approved_at TIMESTAMPTZ,
        executed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS growth_opportunities_status_idx ON growth_opportunities(status);
      CREATE INDEX IF NOT EXISTS growth_opportunities_action_type_idx ON growth_opportunities(action_type);
      CREATE INDEX IF NOT EXISTS growth_opportunities_ev_score_idx ON growth_opportunities(ev_score);
      CREATE INDEX IF NOT EXISTS growth_opportunities_proposed_at_idx ON growth_opportunities(proposed_at);
    `);

    // Growth Outcomes — what actually happened
    await client.query(`
      CREATE TABLE IF NOT EXISTS growth_outcomes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        opportunity_id UUID NOT NULL REFERENCES growth_opportunities(id) ON DELETE CASCADE,
        email_delivered BOOLEAN,
        email_opened BOOLEAN,
        email_opened_at TIMESTAMPTZ,
        email_clicked BOOLEAN,
        email_replied BOOLEAN,
        reply_sentiment VARCHAR(30),
        impressions INTEGER,
        engagements INTEGER,
        link_clicks INTEGER,
        indexed BOOLEAN,
        indexed_at TIMESTAMPTZ,
        campaign_sent_count INTEGER,
        campaign_open_rate NUMERIC(7,4),
        campaign_click_rate NUMERIC(7,4),
        target_signed_up BOOLEAN DEFAULT false,
        target_user_id UUID,
        target_signup_at TIMESTAMPTZ,
        creator_profile_created BOOLEAN DEFAULT false,
        creator_first_post_at TIMESTAMPTZ,
        creator_active BOOLEAN DEFAULT false,
        direct_asbs_created INTEGER NOT NULL DEFAULT 0,
        users_brought INTEGER DEFAULT 0,
        users_reached_first_bet INTEGER DEFAULT 0,
        users_reached_score INTEGER DEFAULT 0,
        users_active_14d INTEGER DEFAULT 0,
        pro_conversions INTEGER DEFAULT 0,
        revenue_cents INTEGER DEFAULT 0,
        ranking_position_30d INTEGER,
        ranking_position_60d INTEGER,
        ranking_position_90d INTEGER,
        monthly_organic_traffic INTEGER,
        measurement_complete BOOLEAN NOT NULL DEFAULT false,
        measurement_complete_at TIMESTAMPTZ,
        first_measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS growth_outcomes_opportunity_idx ON growth_outcomes(opportunity_id);
      CREATE INDEX IF NOT EXISTS growth_outcomes_measurement_idx ON growth_outcomes(measurement_complete);
    `);

    // Outreach Targets — external creators/entities
    await client.query(`
      CREATE TABLE IF NOT EXISTS outreach_targets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        platform VARCHAR(50) NOT NULL,
        platform_id VARCHAR(255),
        display_name VARCHAR(200),
        email VARCHAR(255),
        follower_count INTEGER,
        engagement_rate NUMERIC(7,4),
        sport_focus VARCHAR(50),
        posts_last_7d INTEGER,
        posts_last_30d INTEGER,
        has_existing_platform BOOLEAN DEFAULT false,
        segment VARCHAR(100),
        brain_score NUMERIC(5,1),
        status outreach_target_status NOT NULL DEFAULT 'discovered',
        gammbler_user_id UUID REFERENCES users(id),
        discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        first_contacted_at TIMESTAMPTZ,
        last_contacted_at TIMESTAMPTZ,
        contact_count INTEGER NOT NULL DEFAULT 0,
        UNIQUE(platform, platform_id)
      );
      CREATE INDEX IF NOT EXISTS outreach_targets_status_idx ON outreach_targets(status);
      CREATE INDEX IF NOT EXISTS outreach_targets_segment_idx ON outreach_targets(segment);
    `);

    // Funnel Snapshots — daily health metrics
    await client.query(`
      CREATE TABLE IF NOT EXISTS funnel_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        snapshot_date TIMESTAMPTZ NOT NULL,
        total_users INTEGER NOT NULL DEFAULT 0,
        total_with_first_bet INTEGER NOT NULL DEFAULT 0,
        total_with_sportsbook INTEGER NOT NULL DEFAULT 0,
        total_score_unlocked INTEGER NOT NULL DEFAULT 0,
        total_active_14d INTEGER NOT NULL DEFAULT 0,
        total_active_7d INTEGER NOT NULL DEFAULT 0,
        total_pro_subscribers INTEGER NOT NULL DEFAULT 0,
        total_creators INTEGER NOT NULL DEFAULT 0,
        total_active_creators INTEGER NOT NULL DEFAULT 0,
        signup_to_first_bet_rate NUMERIC(7,4),
        first_bet_to_score_rate NUMERIC(7,4),
        score_to_active_14d_rate NUMERIC(7,4),
        active_to_pro_rate NUMERIC(7,4),
        new_signups_7d INTEGER DEFAULT 0,
        new_asbs_7d INTEGER DEFAULT 0,
        new_creators_7d INTEGER DEFAULT 0,
        new_pro_7d INTEGER DEFAULT 0,
        churned_asbs_7d INTEGER DEFAULT 0,
        net_asb_growth_7d INTEGER DEFAULT 0,
        asbs_from_creator_referral_7d INTEGER DEFAULT 0,
        asbs_from_organic_7d INTEGER DEFAULT 0,
        asbs_from_referral_7d INTEGER DEFAULT 0,
        mrr_cents INTEGER DEFAULT 0,
        mrr_change_cents INTEGER DEFAULT 0,
        biggest_dropoff_stage VARCHAR(100),
        biggest_dropoff_rate NUMERIC(7,4),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS funnel_snapshots_date_unique ON funnel_snapshots(snapshot_date);
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
