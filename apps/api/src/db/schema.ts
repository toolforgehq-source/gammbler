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
  'h2h_first_win', 'h2h_streak_3', 'h2h_streak_5', 'h2h_champion',
]);

export const feedEventTypeEnum = pgEnum('feed_event_type', [
  'parlay_hit', 'rank_up', 'win_streak', 'badge_earned',
  'score_high', 'sportsbook_connected', 'weekly_leader',
  'h2h_challenge', 'h2h_result', 'user_post', 'repost',
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
  date_of_birth: varchar('date_of_birth', { length: 10 }),
  referral_code: varchar('referral_code', { length: 20 }).unique(),
  referred_by: uuid('referred_by'),
  notification_preferences: jsonb('notification_preferences').default('{}'),
  do_not_disturb_start: varchar('do_not_disturb_start', { length: 5 }),
  do_not_disturb_end: varchar('do_not_disturb_end', { length: 5 }),
  verified_score_pass: boolean('verified_score_pass').default(false).notNull(),
  verified_score_pass_purchased_at: timestamp('verified_score_pass_purchased_at', { withTimezone: true }),
  email_verified: boolean('email_verified').default(false).notNull(),
  email_verification_token: varchar('email_verification_token', { length: 64 }),
  password_reset_token: varchar('password_reset_token', { length: 64 }),
  password_reset_expires: timestamp('password_reset_expires', { withTimezone: true }),
  past_due_since: timestamp('past_due_since', { withTimezone: true }),
  payment_flags: jsonb('payment_flags').default('{}'),
  referral_count: integer('referral_count').default(0).notNull(),
  // Growth Brain: acquisition & activity tracking
  utm_source: varchar('utm_source', { length: 100 }),
  utm_medium: varchar('utm_medium', { length: 100 }),
  utm_campaign: varchar('utm_campaign', { length: 200 }),
  last_active_at: timestamp('last_active_at', { withTimezone: true }),
  signup_context: jsonb('signup_context'),
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

export const feedLikes = pgTable('feed_likes', {
  id: uuid('id').defaultRandom().primaryKey(),
  event_id: uuid('event_id').notNull().references(() => feedEvents.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userEventUnique: uniqueIndex('feed_likes_user_event_unique').on(table.user_id, table.event_id),
  eventIdx: index('feed_likes_event_idx').on(table.event_id),
}));

export const feedComments = pgTable('feed_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  event_id: uuid('event_id').notNull().references(() => feedEvents.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  eventIdx: index('feed_comments_event_idx').on(table.event_id),
  userIdx: index('feed_comments_user_idx').on(table.user_id),
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
  banner_url: text('banner_url'),
  profile_photo_url: text('profile_photo_url'),
  favorite_sports: jsonb('favorite_sports').default('[]'),
  favorite_teams: jsonb('favorite_teams').default('[]'),
  betting_style: varchar('betting_style', { length: 100 }),
  social_links: jsonb('social_links').default('{}'),
  total_subscribers: integer('total_subscribers').default(0).notNull(),
  total_followers: integer('total_followers').default(0).notNull(),
  total_tails: integer('total_tails').default(0).notNull(),
  total_earnings_cents: integer('total_earnings_cents').default(0).notNull(),
  verified_at: timestamp('verified_at', { withTimezone: true }).defaultNow().notNull(),
  verified_score: numeric('verified_score', { precision: 5, scale: 1 }).default('0').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  acquisition_source: varchar('acquisition_source', { length: 100 }),
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

// ── Creator Posts (Feed Content) ─────────────────────────────

export const creatorPosts = pgTable('creator_posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  image_url: text('image_url'),
  is_subscriber_only: boolean('is_subscriber_only').default(false).notNull(),
  like_count: integer('like_count').default(0).notNull(),
  comment_count: integer('comment_count').default(0).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('creator_posts_user_idx').on(table.user_id),
  createdAtIdx: index('creator_posts_created_at_idx').on(table.created_at),
  subscriberOnlyIdx: index('creator_posts_sub_only_idx').on(table.is_subscriber_only),
}));

export const creatorPostLikes = pgTable('creator_post_likes', {
  id: uuid('id').defaultRandom().primaryKey(),
  post_id: uuid('post_id').notNull().references(() => creatorPosts.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userPostUnique: uniqueIndex('creator_post_likes_unique').on(table.user_id, table.post_id),
  postIdx: index('creator_post_likes_post_idx').on(table.post_id),
}));

export const creatorPostComments = pgTable('creator_post_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  post_id: uuid('post_id').notNull().references(() => creatorPosts.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  postIdx: index('creator_post_comments_post_idx').on(table.post_id),
  userIdx: index('creator_post_comments_user_idx').on(table.user_id),
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

// ── Head-to-Head Challenges ─────────────────────────────────

export const challengeStatusEnum = pgEnum('challenge_status', [
  'pending', 'accepted', 'declined', 'settled', 'cancelled', 'expired',
]);

export const challenges = pgTable('challenges', {
  id: uuid('id').defaultRandom().primaryKey(),
  challenger_id: uuid('challenger_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  challengee_id: uuid('challengee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sport: sportEnum('sport').notNull(),
  event_name: text('event_name').notNull(),
  event_start_time: timestamp('event_start_time', { withTimezone: true }),
  challenger_pick: text('challenger_pick').notNull(),
  challengee_pick: text('challengee_pick'),
  status: challengeStatusEnum('status').default('pending').notNull(),
  winner_id: uuid('winner_id').references(() => users.id),
  message: text('message'),
  stake_display: varchar('stake_display', { length: 100 }),
  settled_at: timestamp('settled_at', { withTimezone: true }),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  challengerIdx: index('challenges_challenger_idx').on(table.challenger_id),
  challengeeIdx: index('challenges_challengee_idx').on(table.challengee_id),
  statusIdx: index('challenges_status_idx').on(table.status),
  winnerIdx: index('challenges_winner_idx').on(table.winner_id),
  sportIdx: index('challenges_sport_idx').on(table.sport),
  expiresAtIdx: index('challenges_expires_at_idx').on(table.expires_at),
}));

// ── Score Snapshots (historical Gammbler Score tracking) ─────

export const scoreSnapshots = pgTable('score_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sport: sportEnum('sport').notNull(),
  score: numeric('score', { precision: 5, scale: 1 }).notNull(),
  snapshot_date: timestamp('snapshot_date', { withTimezone: true }).notNull(),
}, (table) => ({
  userSportDateUnique: uniqueIndex('score_snapshots_user_sport_date').on(table.user_id, table.sport, table.snapshot_date),
  userIdx: index('score_snapshots_user_idx').on(table.user_id),
  dateIdx: index('score_snapshots_date_idx').on(table.snapshot_date),
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

// ── DFS (Daily Fantasy Sports) ───────────────────────────────

export const dfsSportEnum = pgEnum('dfs_sport', [
  'overall', 'nfl', 'nba', 'mlb', 'nhl', 'pga', 'nascar', 'soccer', 'mma', 'cfb', 'cbb',
]);

export const dfsContestTypeEnum = pgEnum('dfs_contest_type', [
  'cash', 'gpp', 'h2h', 'fifty_fifty', 'multiplier', 'satellite', 'other',
]);

export const dfsPlatformEnum = pgEnum('dfs_platform', [
  'draftkings', 'fanduel', 'yahoo', 'underdog', 'prizepicks', 'other',
]);

export const dfsBadgeTypeEnum = pgEnum('dfs_badge_type', [
  'dfs_first_cash', 'dfs_sharp', 'dfs_elite', 'dfs_legend',
  'dfs_profitable_month', 'dfs_profitable_quarter', 'dfs_consistent',
  'dfs_hot_streak', 'dfs_on_fire', 'dfs_unstoppable',
  'dfs_nfl_sharp', 'dfs_nba_sharp', 'dfs_mlb_sharp', 'dfs_nhl_sharp',
  'dfs_pga_sharp', 'dfs_nascar_sharp',
  'dfs_gpp_winner', 'dfs_grinder', 'dfs_diversified',
]);

export const dfsVerificationStatusEnum = pgEnum('dfs_verification_status', [
  'unverified', 'pending_review', 'verified', 'rejected',
]);

export const dfsContests = pgTable('dfs_contests', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platform: dfsPlatformEnum('platform').notNull(),
  sport: dfsSportEnum('sport').notNull(),
  contest_type: dfsContestTypeEnum('contest_type').notNull(),
  contest_name: text('contest_name'),
  contest_id: varchar('contest_id', { length: 255 }),
  entry_fee_cents: integer('entry_fee_cents').notNull(),
  payout_cents: integer('payout_cents').default(0).notNull(),
  entries: integer('entries'),
  finish_position: integer('finish_position'),
  total_entries: integer('total_entries'),
  points_scored: numeric('points_scored', { precision: 10, scale: 2 }),
  is_manual: boolean('is_manual').default(false).notNull(),
  is_csv_import: boolean('is_csv_import').default(false).notNull(),
  verification_status: dfsVerificationStatusEnum('verification_status').default('unverified').notNull(),
  screenshot_url: text('screenshot_url'),
  contest_url: text('contest_url'),
  contest_date: timestamp('contest_date', { withTimezone: true }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('dfs_contests_user_idx').on(table.user_id),
  sportIdx: index('dfs_contests_sport_idx').on(table.sport),
  contestTypeIdx: index('dfs_contests_type_idx').on(table.contest_type),
  platformIdx: index('dfs_contests_platform_idx').on(table.platform),
  userSportIdx: index('dfs_contests_user_sport_idx').on(table.user_id, table.sport),
  contestDateIdx: index('dfs_contests_date_idx').on(table.contest_date),
}));

export const dfsScores = pgTable('dfs_scores', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sport: dfsSportEnum('sport').notNull(),
  score: numeric('score', { precision: 5, scale: 1 }).default('0').notNull(),
  roi: numeric('roi', { precision: 10, scale: 4 }).default('0'),
  cash_rate: numeric('cash_rate', { precision: 7, scale: 4 }).default('0'),
  consistency: numeric('consistency', { precision: 7, scale: 4 }).default('0'),
  volume_score: numeric('volume_score', { precision: 7, scale: 4 }).default('0'),
  diversity_score: numeric('diversity_score', { precision: 7, scale: 4 }).default('0'),
  total_contests: integer('total_contests').default(0).notNull(),
  total_entry_fees_cents: integer('total_entry_fees_cents').default(0).notNull(),
  total_payouts_cents: integer('total_payouts_cents').default(0).notNull(),
  is_unlocked: boolean('is_unlocked').default(false).notNull(),
  calculated_at: timestamp('calculated_at', { withTimezone: true }).defaultNow().notNull(),
  previous_score: numeric('previous_score', { precision: 5, scale: 1 }),
  score_change_today: numeric('score_change_today', { precision: 5, scale: 1 }).default('0'),
}, (table) => ({
  userSportUnique: uniqueIndex('dfs_scores_user_sport_unique').on(table.user_id, table.sport),
  scoreIdx: index('dfs_scores_score_idx').on(table.score),
  sportIdx: index('dfs_scores_sport_idx').on(table.sport),
}));

export const dfsScoreSnapshots = pgTable('dfs_score_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sport: dfsSportEnum('sport').notNull(),
  score: numeric('score', { precision: 5, scale: 1 }).notNull(),
  snapshot_date: timestamp('snapshot_date', { withTimezone: true }).notNull(),
}, (table) => ({
  userSportDateUnique: uniqueIndex('dfs_snapshots_user_sport_date').on(table.user_id, table.sport, table.snapshot_date),
  userIdx: index('dfs_snapshots_user_idx').on(table.user_id),
  dateIdx: index('dfs_snapshots_date_idx').on(table.snapshot_date),
}));

export const dfsBadges = pgTable('dfs_badges', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  badge_type: dfsBadgeTypeEnum('badge_type').notNull(),
  earned_at: timestamp('earned_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userBadgeUnique: uniqueIndex('dfs_badges_user_type_unique').on(table.user_id, table.badge_type),
  userIdx: index('dfs_badges_user_idx').on(table.user_id),
}));

export const dfsCsvImports = pgTable('dfs_csv_imports', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platform: dfsPlatformEnum('platform').notNull(),
  file_name: varchar('file_name', { length: 255 }).notNull(),
  rows_imported: integer('rows_imported').default(0).notNull(),
  rows_skipped: integer('rows_skipped').default(0).notNull(),
  imported_at: timestamp('imported_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('dfs_csv_imports_user_idx').on(table.user_id),
}));

// ── Creator Badges (separate from betting badges) ─────────────

export const creatorBadges = pgTable('creator_badges', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  badge_id: varchar('badge_id', { length: 50 }).notNull(),
  earned_at: timestamp('earned_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userBadgeUnique: uniqueIndex('creator_badges_user_badge_unique').on(table.user_id, table.badge_id),
  userIdx: index('creator_badges_user_idx').on(table.user_id),
}));

// ── Content Reports (moderation) ───────────────────────────────

export const contentReports = pgTable('content_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reporter_user_id: uuid('reporter_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  post_id: uuid('post_id').references(() => creatorPosts.id, { onDelete: 'cascade' }),
  reported_user_id: uuid('reported_user_id').references(() => users.id, { onDelete: 'cascade' }),
  reason: varchar('reason', { length: 100 }).notNull(),
  details: text('details'),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  reviewed_at: timestamp('reviewed_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('content_reports_status_idx').on(table.status),
  postIdx: index('content_reports_post_idx').on(table.post_id),
}));

// ══════════════════════════════════════════════════════════════
// GROWTH BRAIN — AI Chief Growth Officer
// ══════════════════════════════════════════════════════════════

// ── Growth Brain Enums ────────────────────────────────────────

export const growthActionTypeEnum = pgEnum('growth_action_type', [
  'creator_outreach', 'onboarding_nudge', 'referral_campaign',
  'retention_campaign', 'seo_article', 'social_content',
  'community_reply', 'ai_discoverability_page',
]);

export const growthOpportunityStatusEnum = pgEnum('growth_opportunity_status', [
  'proposed', 'approved', 'rejected', 'executed', 'measuring', 'expired', 'completed',
]);

export const outreachTargetStatusEnum = pgEnum('outreach_target_status', [
  'discovered', 'queued', 'contacted', 'replied', 'converted', 'declined', 'no_response',
]);

// ── Growth Beliefs ────────────────────────────────────────────

export const growthBeliefs = pgTable('growth_beliefs', {
  id: uuid('id').defaultRandom().primaryKey(),
  belief_key: varchar('belief_key', { length: 200 }).notNull().unique(),
  belief_value: numeric('belief_value', { precision: 12, scale: 6 }).notNull(),
  sample_size: integer('sample_size').default(0).notNull(),
  confidence: numeric('confidence', { precision: 5, scale: 4 }).default('0').notNull(),
  previous_value: numeric('previous_value', { precision: 12, scale: 6 }),
  previous_sample_size: integer('previous_sample_size'),
  updated_reason: text('updated_reason'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  beliefKeyIdx: index('growth_beliefs_key_idx').on(table.belief_key),
}));

// ── Growth Opportunities ──────────────────────────────────────

export const growthOpportunities = pgTable('growth_opportunities', {
  id: uuid('id').defaultRandom().primaryKey(),
  action_type: growthActionTypeEnum('action_type').notNull(),
  channel: varchar('channel', { length: 50 }).notNull(),
  why_this: text('why_this').notNull(),
  why_now: text('why_now').notNull(),
  evidence: jsonb('evidence').default('{}').notNull(),
  expected_asbs: numeric('expected_asbs', { precision: 10, scale: 4 }).notNull(),
  p_success: numeric('p_success', { precision: 7, scale: 6 }).notNull(),
  confidence: numeric('confidence', { precision: 5, scale: 4 }).notNull(),
  urgency: numeric('urgency', { precision: 5, scale: 2 }).default('1.00').notNull(),
  ev_score: numeric('ev_score', { precision: 12, scale: 6 }).notNull(),
  cost_dollars: numeric('cost_dollars', { precision: 10, scale: 2 }).default('0'),
  founder_time_minutes: integer('founder_time_minutes').default(0),
  asbs_per_dollar: numeric('asbs_per_dollar', { precision: 10, scale: 4 }),
  asbs_per_minute: numeric('asbs_per_minute', { precision: 10, scale: 6 }),
  success_criteria: text('success_criteria').notNull(),
  learning_objective: text('learning_objective').notNull(),
  content: jsonb('content'),
  target_type: varchar('target_type', { length: 50 }),
  target_id: varchar('target_id', { length: 255 }),
  target_metadata: jsonb('target_metadata'),
  status: growthOpportunityStatusEnum('status').default('proposed').notNull(),
  rejection_reason: text('rejection_reason'),
  is_exploratory: boolean('is_exploratory').default(false).notNull(),
  measurement_window_days: integer('measurement_window_days').default(30).notNull(),
  proposed_at: timestamp('proposed_at', { withTimezone: true }).defaultNow().notNull(),
  approved_at: timestamp('approved_at', { withTimezone: true }),
  executed_at: timestamp('executed_at', { withTimezone: true }),
  expires_at: timestamp('expires_at', { withTimezone: true }),
  completed_at: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  statusIdx: index('growth_opportunities_status_idx').on(table.status),
  actionTypeIdx: index('growth_opportunities_action_type_idx').on(table.action_type),
  evScoreIdx: index('growth_opportunities_ev_score_idx').on(table.ev_score),
  proposedAtIdx: index('growth_opportunities_proposed_at_idx').on(table.proposed_at),
}));

// ── Growth Outcomes ───────────────────────────────────────────

export const growthOutcomes = pgTable('growth_outcomes', {
  id: uuid('id').defaultRandom().primaryKey(),
  opportunity_id: uuid('opportunity_id').notNull().references(() => growthOpportunities.id, { onDelete: 'cascade' }),
  email_delivered: boolean('email_delivered'),
  email_opened: boolean('email_opened'),
  email_opened_at: timestamp('email_opened_at', { withTimezone: true }),
  email_clicked: boolean('email_clicked'),
  email_replied: boolean('email_replied'),
  reply_sentiment: varchar('reply_sentiment', { length: 30 }),
  impressions: integer('impressions'),
  engagements: integer('engagements'),
  link_clicks: integer('link_clicks'),
  indexed: boolean('indexed'),
  indexed_at: timestamp('indexed_at', { withTimezone: true }),
  campaign_sent_count: integer('campaign_sent_count'),
  campaign_open_rate: numeric('campaign_open_rate', { precision: 7, scale: 4 }),
  campaign_click_rate: numeric('campaign_click_rate', { precision: 7, scale: 4 }),
  target_signed_up: boolean('target_signed_up').default(false),
  target_user_id: uuid('target_user_id'),
  target_signup_at: timestamp('target_signup_at', { withTimezone: true }),
  creator_profile_created: boolean('creator_profile_created').default(false),
  creator_first_post_at: timestamp('creator_first_post_at', { withTimezone: true }),
  creator_active: boolean('creator_active').default(false),
  direct_asbs_created: integer('direct_asbs_created').default(0).notNull(),
  users_brought: integer('users_brought').default(0),
  users_reached_first_bet: integer('users_reached_first_bet').default(0),
  users_reached_score: integer('users_reached_score').default(0),
  users_active_14d: integer('users_active_14d').default(0),
  pro_conversions: integer('pro_conversions').default(0),
  revenue_cents: integer('revenue_cents').default(0),
  ranking_position_30d: integer('ranking_position_30d'),
  ranking_position_60d: integer('ranking_position_60d'),
  ranking_position_90d: integer('ranking_position_90d'),
  monthly_organic_traffic: integer('monthly_organic_traffic'),
  measurement_complete: boolean('measurement_complete').default(false).notNull(),
  measurement_complete_at: timestamp('measurement_complete_at', { withTimezone: true }),
  first_measured_at: timestamp('first_measured_at', { withTimezone: true }).defaultNow().notNull(),
  last_measured_at: timestamp('last_measured_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  opportunityIdx: index('growth_outcomes_opportunity_idx').on(table.opportunity_id),
  measurementIdx: index('growth_outcomes_measurement_idx').on(table.measurement_complete),
}));

// ── Outreach Targets ──────────────────────────────────────────

export const outreachTargets = pgTable('outreach_targets', {
  id: uuid('id').defaultRandom().primaryKey(),
  platform: varchar('platform', { length: 50 }).notNull(),
  platform_id: varchar('platform_id', { length: 255 }),
  display_name: varchar('display_name', { length: 200 }),
  email: varchar('email', { length: 255 }),
  follower_count: integer('follower_count'),
  engagement_rate: numeric('engagement_rate', { precision: 7, scale: 4 }),
  sport_focus: varchar('sport_focus', { length: 50 }),
  posts_last_7d: integer('posts_last_7d'),
  posts_last_30d: integer('posts_last_30d'),
  has_existing_platform: boolean('has_existing_platform').default(false),
  segment: varchar('segment', { length: 100 }),
  brain_score: numeric('brain_score', { precision: 5, scale: 1 }),
  status: outreachTargetStatusEnum('status').default('discovered').notNull(),
  gammbler_user_id: uuid('gammbler_user_id').references(() => users.id),
  discovered_at: timestamp('discovered_at', { withTimezone: true }).defaultNow().notNull(),
  first_contacted_at: timestamp('first_contacted_at', { withTimezone: true }),
  last_contacted_at: timestamp('last_contacted_at', { withTimezone: true }),
  contact_count: integer('contact_count').default(0).notNull(),
}, (table) => ({
  platformIdUnique: uniqueIndex('outreach_targets_platform_unique').on(table.platform, table.platform_id),
  statusIdx: index('outreach_targets_status_idx').on(table.status),
  segmentIdx: index('outreach_targets_segment_idx').on(table.segment),
}));

// ── Funnel Snapshots ──────────────────────────────────────────

export const funnelSnapshots = pgTable('funnel_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  snapshot_date: timestamp('snapshot_date', { withTimezone: true }).notNull(),
  total_users: integer('total_users').default(0).notNull(),
  total_with_first_bet: integer('total_with_first_bet').default(0).notNull(),
  total_with_sportsbook: integer('total_with_sportsbook').default(0).notNull(),
  total_score_unlocked: integer('total_score_unlocked').default(0).notNull(),
  total_active_14d: integer('total_active_14d').default(0).notNull(),
  total_active_7d: integer('total_active_7d').default(0).notNull(),
  total_pro_subscribers: integer('total_pro_subscribers').default(0).notNull(),
  total_creators: integer('total_creators').default(0).notNull(),
  total_active_creators: integer('total_active_creators').default(0).notNull(),
  signup_to_first_bet_rate: numeric('signup_to_first_bet_rate', { precision: 7, scale: 4 }),
  first_bet_to_score_rate: numeric('first_bet_to_score_rate', { precision: 7, scale: 4 }),
  score_to_active_14d_rate: numeric('score_to_active_14d_rate', { precision: 7, scale: 4 }),
  active_to_pro_rate: numeric('active_to_pro_rate', { precision: 7, scale: 4 }),
  new_signups_7d: integer('new_signups_7d').default(0),
  new_asbs_7d: integer('new_asbs_7d').default(0),
  new_creators_7d: integer('new_creators_7d').default(0),
  new_pro_7d: integer('new_pro_7d').default(0),
  churned_asbs_7d: integer('churned_asbs_7d').default(0),
  net_asb_growth_7d: integer('net_asb_growth_7d').default(0),
  asbs_from_creator_referral_7d: integer('asbs_from_creator_referral_7d').default(0),
  asbs_from_organic_7d: integer('asbs_from_organic_7d').default(0),
  asbs_from_referral_7d: integer('asbs_from_referral_7d').default(0),
  mrr_cents: integer('mrr_cents').default(0),
  mrr_change_cents: integer('mrr_change_cents').default(0),
  biggest_dropoff_stage: varchar('biggest_dropoff_stage', { length: 100 }),
  biggest_dropoff_rate: numeric('biggest_dropoff_rate', { precision: 7, scale: 4 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  snapshotDateUnique: uniqueIndex('funnel_snapshots_date_unique').on(table.snapshot_date),
}));
