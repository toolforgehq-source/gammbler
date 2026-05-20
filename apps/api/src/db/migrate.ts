import { Pool } from 'pg';
import { env } from '../config/env';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
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
