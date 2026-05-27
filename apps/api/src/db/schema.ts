import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  integer,
  pgEnum,
  uniqueIndex,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';

// ── Enums ────────────────────────────────────────────────────

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing', 'active', 'past_due', 'cancelled', 'paused',
]);

export const betResultEnum = pgEnum('bet_result', [
  'win', 'loss', 'push', 'pending', 'void',
]);

export const sportEnum = pgEnum('sport', [
  'overall', 'nfl', 'nba', 'mlb', 'nhl', 'cfb', 'cbb', 'soccer', 'prizepicks', 'dfs',
]);

export const platformEnum = pgEnum('platform', [
  'draftkings', 'fanduel', 'betmgm', 'caesars', 'espn_bet', 'pointsbet',
  'wynnbet', 'prizepicks', 'underdog', 'espn_fantasy', 'yahoo_fantasy', 'other',
]);

export const betTypeEnum = pgEnum('bet_type', [
  'spread', 'moneyline', 'over_under', 'parlay', 'prop', 'player_prop',
  'teaser', 'futures', 'other',
]);

export const badgeTypeEnum = pgEnum('badge_type', [
  'first_win', 'sharp_shooter', 'elite_status', 'legend',
  'profitable_month', 'profitable_quarter', 'consistent',
  'hot_streak', 'on_fire', 'unstoppable',
  'nfl_sharp', 'nba_sharp', 'mlb_sharp', 'nhl_sharp', 'cfb_sharp', 'cbb_sharp',
  'connected', 'all_in', 'diversified', 'veteran',
]);

export const feedEventTypeEnum = pgEnum('feed_event_type', [
  'parlay_hit', 'rank_up', 'win_streak', 'badge_earned',
  'score_high', 'sportsbook_connected', 'weekly_leader',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'trial_ending_10', 'trial_ending_13', 'trial_ended',
  'weekly_report', 'badge_earned', 'leaderboard_passed',
  'score_change', 'bet_settled', 'new_follower',
]);

// ── Tables ───────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 30 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: text('password_hash').notNull(),
  avatar_url: text('avatar_url'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  trial_ends_at: timestamp('trial_ends_at', { withTimezone: true }).notNull(),
  subscription_status: subscriptionStatusEnum('subscription_status').default('trialing').notNull(),
  stripe_customer_id: varchar('stripe_customer_id', { length: 255 }),
  is_profile_public: boolean('is_profile_public').default(true).notNull(),
  tos_accepted_at: timestamp('tos_accepted_at', { withTimezone: true }),
  referral_code: varchar('referral_code', { length: 20 }).unique(),
  referred_by: uuid('referred_by'),
  notification_preferences: jsonb('notification_preferences').default('{}'),
  do_not_disturb_start: varchar('do_not_disturb_start', { length: 5 }),
  do_not_disturb_end: varchar('do_not_disturb_end', { length: 5 }),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  usernameIdx: index('users_username_idx').on(table.username),
}));

export const bets = pgTable('bets', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platform: platformEnum('platform').notNull(),
  sport: sportEnum('sport').notNull(),
  league: varchar('league', { length: 50 }),
  bet_type: betTypeEnum('bet_type').notNull(),
  selection: text('selection').notNull(),
  odds: numeric('odds', { precision: 10, scale: 4 }).notNull(),
  stake: numeric('stake', { precision: 12, scale: 2 }).notNull(),
  result: betResultEnum('result').default('pending').notNull(),
  profit_loss: numeric('profit_loss', { precision: 12, scale: 2 }).default('0'),
  settled_at: timestamp('settled_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  is_manual: boolean('is_manual').default(false).notNull(),
  opening_odds: numeric('opening_odds', { precision: 10, scale: 4 }),
  closing_odds: numeric('closing_odds', { precision: 10, scale: 4 }),
  sharpsports_bet_id: varchar('sharpsports_bet_id', { length: 255 }),
  event_name: text('event_name'),
  parlay_legs: integer('parlay_legs'),
  event_start_time: timestamp('event_start_time', { withTimezone: true }),
  is_pregame_verified: boolean('is_pregame_verified').default(false).notNull(),
  odds_api_event_id: varchar('odds_api_event_id', { length: 255 }),
}, (table) => ({
  userIdIdx: index('bets_user_id_idx').on(table.user_id),
  sportIdx: index('bets_sport_idx').on(table.sport),
  resultIdx: index('bets_result_idx').on(table.result),
  settledAtIdx: index('bets_settled_at_idx').on(table.settled_at),
  userSportIdx: index('bets_user_sport_idx').on(table.user_id, table.sport),
  platformIdx: index('bets_platform_idx').on(table.platform),
}));

export const gammblerScores = pgTable('gammbler_scores', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sport: sportEnum('sport').notNull(),
  score: numeric('score', { precision: 5, scale: 1 }).default('0').notNull(),
  win_rate: numeric('win_rate', { precision: 7, scale: 4 }).default('0'),
  roi: numeric('roi', { precision: 10, scale: 4 }).default('0'),
  clv: numeric('clv', { precision: 7, scale: 4 }).default('0'),
  stake_consistency: numeric('stake_consistency', { precision: 7, scale: 4 }).default('0'),
  volume_score: numeric('volume_score', { precision: 7, scale: 4 }).default('0'),
  diversity_score: numeric('diversity_score', { precision: 7, scale: 4 }).default('0'),
  settled_bet_count: integer('settled_bet_count').default(0).notNull(),
  is_unlocked: boolean('is_unlocked').default(false).notNull(),
  calculated_at: timestamp('calculated_at', { withTimezone: true }).defaultNow().notNull(),
  previous_score: numeric('previous_score', { precision: 5, scale: 1 }),
  score_change_today: numeric('score_change_today', { precision: 5, scale: 1 }).default('0'),
}, (table) => ({
  userSportUnique: uniqueIndex('scores_user_sport_unique').on(table.user_id, table.sport),
  scoreIdx: index('scores_score_idx').on(table.score),
  sportIdx: index('scores_sport_idx').on(table.sport),
}));

export const follows = pgTable('follows', {
  id: uuid('id').defaultRandom().primaryKey(),
  follower_id: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  following_id: uuid('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  followUnique: uniqueIndex('follows_unique').on(table.follower_id, table.following_id),
  followerIdx: index('follows_follower_idx').on(table.follower_id),
  followingIdx: index('follows_following_idx').on(table.following_id),
}));

export const badges = pgTable('badges', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  badge_type: badgeTypeEnum('badge_type').notNull(),
  earned_at: timestamp('earned_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userBadgeUnique: uniqueIndex('badges_user_type_unique').on(table.user_id, table.badge_type),
  userIdx: index('badges_user_idx').on(table.user_id),
}));

export const feedEvents = pgTable('feed_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  event_type: feedEventTypeEnum('event_type').notNull(),
  event_data: jsonb('event_data').default('{}').notNull(),
  sport: sportEnum('sport'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index('feed_events_created_at_idx').on(table.created_at),
  userIdx: index('feed_events_user_idx').on(table.user_id),
}));

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  read: boolean('read').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('notifications_user_idx').on(table.user_id),
  readIdx: index('notifications_read_idx').on(table.user_id, table.read),
}));

export const sportsbookConnections = pgTable('sportsbook_connections', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platform: platformEnum('platform').notNull(),
  sharpsports_account_id: varchar('sharpsports_account_id', { length: 255 }),
  connected_at: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
  last_synced_at: timestamp('last_synced_at', { withTimezone: true }),
  is_csv_import: boolean('is_csv_import').default(false).notNull(),
}, (table) => ({
  userPlatformUnique: uniqueIndex('connections_user_platform_unique').on(table.user_id, table.platform),
  userIdx: index('connections_user_idx').on(table.user_id),
}));

export const leaderboardSeasons = pgTable('leaderboard_seasons', {
  id: uuid('id').defaultRandom().primaryKey(),
  sport: sportEnum('sport').notNull(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  champion_user_id: uuid('champion_user_id').references(() => users.id),
  started_at: timestamp('started_at', { withTimezone: true }).notNull(),
  ended_at: timestamp('ended_at', { withTimezone: true }),
}, (table) => ({
  sportMonthUnique: uniqueIndex('seasons_sport_month_unique').on(table.sport, table.month, table.year),
}));

// ── Leagues ──────────────────────────────────────────────────

export const leagueStatusEnum = pgEnum('league_status', [
  'active', 'completed', 'archived',
]);

export const leagueSportEnum = pgEnum('league_sport', [
  'all', 'nfl', 'nba', 'mlb', 'nhl', 'cfb', 'cbb', 'soccer', 'mma',
]);

export const leagueMemberRoleEnum = pgEnum('league_member_role', [
  'commissioner', 'member',
]);

export const leagues = pgTable('leagues', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  sport: leagueSportEnum('sport').notNull(),
  status: leagueStatusEnum('status').default('active').notNull(),
  commissioner_id: uuid('commissioner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invite_code: varchar('invite_code', { length: 20 }).notNull().unique(),
  min_bets_per_week: integer('min_bets_per_week').default(1).notNull(),
  min_active_weeks_pct: integer('min_active_weeks_pct').default(75).notNull(),
  season_name: varchar('season_name', { length: 100 }),
  season_start: timestamp('season_start', { withTimezone: true }).notNull(),
  season_end: timestamp('season_end', { withTimezone: true }).notNull(),
  max_members: integer('max_members').default(20).notNull(),
  is_cash_league: boolean('is_cash_league').default(false).notNull(),
  buy_in_cents: integer('buy_in_cents').default(0).notNull(),
  rake_pct: integer('rake_pct').default(10).notNull(),
  prize_pool_cents: integer('prize_pool_cents').default(0).notNull(),
  payout_status: varchar('payout_status', { length: 20 }).default('pending'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  commissionerIdx: index('leagues_commissioner_idx').on(table.commissioner_id),
  inviteCodeIdx: index('leagues_invite_code_idx').on(table.invite_code),
  statusIdx: index('leagues_status_idx').on(table.status),
}));

export const leagueMembers = pgTable('league_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  league_id: uuid('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: leagueMemberRoleEnum('role').default('member').notNull(),
  joined_at: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  season_score: numeric('season_score', { precision: 5, scale: 1 }).default('0').notNull(),
  active_weeks: integer('active_weeks').default(0).notNull(),
  total_weeks: integer('total_weeks').default(0).notNull(),
  total_bets_in_league: integer('total_bets_in_league').default(0).notNull(),
  best_week_score: numeric('best_week_score', { precision: 5, scale: 1 }).default('0'),
  current_streak: integer('current_streak').default(0),
}, (table) => ({
  leagueUserUnique: uniqueIndex('league_members_unique').on(table.league_id, table.user_id),
  leagueIdx: index('league_members_league_idx').on(table.league_id),
  userIdx: index('league_members_user_idx').on(table.user_id),
}));

export const leagueWeeklyScores = pgTable('league_weekly_scores', {
  id: uuid('id').defaultRandom().primaryKey(),
  league_id: uuid('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  week_number: integer('week_number').notNull(),
  week_start: timestamp('week_start', { withTimezone: true }).notNull(),
  week_end: timestamp('week_end', { withTimezone: true }).notNull(),
  score: numeric('score', { precision: 5, scale: 1 }).default('0').notNull(),
  bets_placed: integer('bets_placed').default(0).notNull(),
  wins: integer('wins').default(0).notNull(),
  losses: integer('losses').default(0).notNull(),
  pushes: integer('pushes').default(0).notNull(),
  roi: numeric('roi', { precision: 10, scale: 4 }).default('0'),
  met_minimum: boolean('met_minimum').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  leagueUserWeekUnique: uniqueIndex('league_weekly_unique').on(table.league_id, table.user_id, table.week_number),
  leagueWeekIdx: index('league_weekly_league_week_idx').on(table.league_id, table.week_number),
}));

export const leagueAwards = pgTable('league_awards', {
  id: uuid('id').defaultRandom().primaryKey(),
  league_id: uuid('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  award_type: varchar('award_type', { length: 50 }).notNull(),
  award_name: varchar('award_name', { length: 100 }).notNull(),
  description: text('description'),
  awarded_at: timestamp('awarded_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  leagueIdx: index('league_awards_league_idx').on(table.league_id),
  userIdx: index('league_awards_user_idx').on(table.user_id),
}));

// ── Bet Slips (Live Bet Slip Sharing) ────────────────────────

export const betSlipStatusEnum = pgEnum('bet_slip_status', [
  'live', 'won', 'lost', 'pushed', 'void',
]);

export const slipReactionTypeEnum = pgEnum('slip_reaction_type', [
  'fire', 'skull', 'money', 'clown', 'goat',
]);

export const betSlips = pgTable('bet_slips', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bet_id: uuid('bet_id').references(() => bets.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  sport: sportEnum('sport').notNull(),
  bet_type: betTypeEnum('bet_type').notNull(),
  selection: text('selection').notNull(),
  odds: numeric('odds', { precision: 10, scale: 4 }).notNull(),
  stake: numeric('stake', { precision: 12, scale: 2 }).notNull(),
  platform: platformEnum('platform').notNull(),
  status: betSlipStatusEnum('status').default('live').notNull(),
  event_name: text('event_name'),
  parlay_legs: integer('parlay_legs'),
  profit_loss: numeric('profit_loss', { precision: 12, scale: 2 }),
  views_count: integer('views_count').default(0).notNull(),
  shares_count: integer('shares_count').default(0).notNull(),
  is_public: boolean('is_public').default(true).notNull(),
  shared_at: timestamp('shared_at', { withTimezone: true }).defaultNow().notNull(),
  settled_at: timestamp('settled_at', { withTimezone: true }),
}, (table) => ({
  userIdx: index('bet_slips_user_idx').on(table.user_id),
  statusIdx: index('bet_slips_status_idx').on(table.status),
  sharedAtIdx: index('bet_slips_shared_at_idx').on(table.shared_at),
  sportIdx: index('bet_slips_sport_idx').on(table.sport),
}));

export const betSlipReactions = pgTable('bet_slip_reactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  slip_id: uuid('slip_id').notNull().references(() => betSlips.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reaction: slipReactionTypeEnum('reaction').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  slipUserUnique: uniqueIndex('slip_reactions_unique').on(table.slip_id, table.user_id),
  slipIdx: index('slip_reactions_slip_idx').on(table.slip_id),
}));

// ── Capper Marketplace (Tail This) ──────────────────────────

export const capperStatusEnum = pgEnum('capper_status', [
  'pending', 'active', 'suspended',
]);

export const capperSubStatusEnum = pgEnum('capper_sub_status', [
  'active', 'cancelled', 'expired',
]);

export const capperProfiles = pgTable('capper_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  display_name: varchar('display_name', { length: 100 }).notNull(),
  bio: text('bio'),
  price_cents: integer('price_cents').default(499).notNull(),
  status: capperStatusEnum('status').default('active').notNull(),
  total_subscribers: integer('total_subscribers').default(0).notNull(),
  total_tails: integer('total_tails').default(0).notNull(),
  total_earnings_cents: integer('total_earnings_cents').default(0).notNull(),
  verified_at: timestamp('verified_at', { withTimezone: true }).defaultNow().notNull(),
  verified_score: numeric('verified_score', { precision: 5, scale: 1 }).default('0').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('capper_profiles_user_idx').on(table.user_id),
  statusIdx: index('capper_profiles_status_idx').on(table.status),
}));

export const capperSubscriptions = pgTable('capper_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  capper_user_id: uuid('capper_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subscriber_user_id: uuid('subscriber_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: capperSubStatusEnum('status').default('active').notNull(),
  price_cents: integer('price_cents').notNull(),
  stripe_subscription_id: varchar('stripe_subscription_id', { length: 255 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }),
}, (table) => ({
  capperSubUnique: uniqueIndex('capper_sub_unique').on(table.capper_user_id, table.subscriber_user_id),
  capperIdx: index('capper_sub_capper_idx').on(table.capper_user_id),
  subscriberIdx: index('capper_sub_subscriber_idx').on(table.subscriber_user_id),
  statusIdx: index('capper_sub_status_idx').on(table.status),
}));

export const tailEvents = pgTable('tail_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  slip_id: uuid('slip_id').notNull().references(() => betSlips.id, { onDelete: 'cascade' }),
  capper_user_id: uuid('capper_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tailer_user_id: uuid('tailer_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  slipIdx: index('tail_events_slip_idx').on(table.slip_id),
  capperIdx: index('tail_events_capper_idx').on(table.capper_user_id),
  tailerIdx: index('tail_events_tailer_idx').on(table.tailer_user_id),
}));

// ── Score Card Generations (monthly tracking for free users) ─

export const scoreCardGenerations = pgTable('score_card_generations', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sport: sportEnum('sport').notNull(),
  generated_at: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('score_card_gen_user_idx').on(table.user_id),
  generatedAtIdx: index('score_card_gen_date_idx').on(table.generated_at),
}));

// ── Cash Leagues ─────────────────────────────────────────────

export const cashLeaguePayoutStatusEnum = pgEnum('cash_league_payout_status', [
  'pending', 'processing', 'completed', 'failed',
]);

export const leagueEntries = pgTable('league_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  league_id: uuid('league_id').notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  buy_in_paid_cents: integer('buy_in_paid_cents').notNull(),
  payout_cents: integer('payout_cents').default(0).notNull(),
  stripe_payment_id: varchar('stripe_payment_id', { length: 255 }),
  paid_at: timestamp('paid_at', { withTimezone: true }).defaultNow().notNull(),
  payout_at: timestamp('payout_at', { withTimezone: true }),
}, (table) => ({
  leagueUserUnique: uniqueIndex('league_entries_unique').on(table.league_id, table.user_id),
  leagueIdx: index('league_entries_league_idx').on(table.league_id),
  userIdx: index('league_entries_user_idx').on(table.user_id),
}));

// ── Weekly Reports ───────────────────────────────────────────

export const weeklyReports = pgTable('weekly_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  week_start: timestamp('week_start', { withTimezone: true }).notNull(),
  week_end: timestamp('week_end', { withTimezone: true }).notNull(),
  record_wins: integer('record_wins').default(0).notNull(),
  record_losses: integer('record_losses').default(0).notNull(),
  record_pushes: integer('record_pushes').default(0).notNull(),
  score_change: numeric('score_change', { precision: 5, scale: 1 }),
  biggest_win: numeric('biggest_win', { precision: 12, scale: 2 }),
  biggest_loss: numeric('biggest_loss', { precision: 12, scale: 2 }),
  insight: text('insight'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userWeekUnique: uniqueIndex('reports_user_week_unique').on(table.user_id, table.week_start),
}));
