// ============================================================
// @gammbler/shared — types, constants, and utilities
// ============================================================

// ── Enums ────────────────────────────────────────────────────

export enum Sport {
  OVERALL = 'overall',
  NFL = 'nfl',
  NBA = 'nba',
  MLB = 'mlb',
  NHL = 'nhl',
  CFB = 'cfb',
  CBB = 'cbb',
  SOCCER = 'soccer',
  PRIZEPICKS = 'prizepicks',
  DFS = 'dfs',
}

export enum BetType {
  SPREAD = 'spread',
  MONEYLINE = 'moneyline',
  OVER_UNDER = 'over_under',
  PARLAY = 'parlay',
  PROP = 'prop',
  PLAYER_PROP = 'player_prop',
  TEASER = 'teaser',
  FUTURES = 'futures',
  OTHER = 'other',
}

export enum BetResult {
  WIN = 'win',
  LOSS = 'loss',
  PUSH = 'push',
  PENDING = 'pending',
  VOID = 'void',
}

export enum Platform {
  DRAFTKINGS = 'draftkings',
  FANDUEL = 'fanduel',
  BETMGM = 'betmgm',
  CAESARS = 'caesars',
  ESPN_BET = 'espn_bet',
  POINTSBET = 'pointsbet',
  WYNNBET = 'wynnbet',
  PRIZEPICKS = 'prizepicks',
  UNDERDOG = 'underdog',
  ESPN_FANTASY = 'espn_fantasy',
  YAHOO_FANTASY = 'yahoo_fantasy',
  OTHER = 'other',
}

export enum SubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
  PAUSED = 'paused',
}

export enum ScoreTier {
  RECREATIONAL = 'recreational',
  DEVELOPING = 'developing',
  SHARP = 'sharp',
  ELITE = 'elite',
  LEGEND = 'legend',
}

export enum BadgeType {
  // Performance
  FIRST_WIN = 'first_win',
  SHARP_SHOOTER = 'sharp_shooter',
  ELITE_STATUS = 'elite_status',
  LEGEND = 'legend',
  PROFITABLE_MONTH = 'profitable_month',
  PROFITABLE_QUARTER = 'profitable_quarter',
  CONSISTENT = 'consistent',
  // Streaks
  HOT_STREAK = 'hot_streak',
  ON_FIRE = 'on_fire',
  UNSTOPPABLE = 'unstoppable',
  // Sport specialist
  NFL_SHARP = 'nfl_sharp',
  NBA_SHARP = 'nba_sharp',
  MLB_SHARP = 'mlb_sharp',
  NHL_SHARP = 'nhl_sharp',
  CFB_SHARP = 'cfb_sharp',
  CBB_SHARP = 'cbb_sharp',
  // Activity
  CONNECTED = 'connected',
  ALL_IN = 'all_in',
  DIVERSIFIED = 'diversified',
  VETERAN = 'veteran',
  // Head-to-Head
  H2H_FIRST_WIN = 'h2h_first_win',
  H2H_STREAK_3 = 'h2h_streak_3',
  H2H_STREAK_5 = 'h2h_streak_5',
  H2H_CHAMPION = 'h2h_champion',
}

export enum FeedEventType {
  PARLAY_HIT = 'parlay_hit',
  RANK_UP = 'rank_up',
  WIN_STREAK = 'win_streak',
  BADGE_EARNED = 'badge_earned',
  SCORE_HIGH = 'score_high',
  SPORTSBOOK_CONNECTED = 'sportsbook_connected',
  WEEKLY_LEADER = 'weekly_leader',
  H2H_CHALLENGE = 'h2h_challenge',
  H2H_RESULT = 'h2h_result',
}

export enum NotificationType {
  TRIAL_ENDING_10 = 'trial_ending_10',
  TRIAL_ENDING_13 = 'trial_ending_13',
  TRIAL_ENDED = 'trial_ended',
  WEEKLY_REPORT = 'weekly_report',
  BADGE_EARNED = 'badge_earned',
  LEADERBOARD_PASSED = 'leaderboard_passed',
  SCORE_CHANGE = 'score_change',
  BET_SETTLED = 'bet_settled',
  NEW_FOLLOWER = 'new_follower',
}

// ── Interfaces ───────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  trial_ends_at: string;
  subscription_status: SubscriptionStatus;
  stripe_customer_id: string | null;
  is_profile_public: boolean;
}

export interface Bet {
  id: string;
  user_id: string;
  platform: Platform;
  sport: Sport;
  league: string | null;
  bet_type: BetType;
  selection: string;
  odds: number;
  stake: number;
  result: BetResult;
  profit_loss: number;
  settled_at: string | null;
  created_at: string;
  is_manual: boolean;
  opening_odds: number | null;
  closing_odds: number | null;
}

export interface GammblerScore {
  id: string;
  user_id: string;
  sport: Sport;
  score: number;
  win_rate: number;
  roi: number;
  clv: number;
  stake_consistency: number;
  volume_score: number;
  diversity_score: number;
  settled_bet_count: number;
  is_unlocked: boolean;
  calculated_at: string;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Badge {
  id: string;
  user_id: string;
  badge_type: BadgeType;
  earned_at: string;
}

export interface FeedEvent {
  id: string;
  user_id: string;
  event_type: FeedEventType;
  event_data: Record<string, unknown>;
  sport: Sport | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface SportsbookConnection {
  id: string;
  user_id: string;
  platform: Platform;
  sharpsports_account_id: string | null;
  connected_at: string;
  last_synced_at: string | null;
}

export enum LeagueSport {
  ALL = 'all',
  NFL = 'nfl',
  NBA = 'nba',
  MLB = 'mlb',
  NHL = 'nhl',
  CFB = 'cfb',
  CBB = 'cbb',
  SOCCER = 'soccer',
  MMA = 'mma',
}

export enum LeagueStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export enum LeagueMemberRole {
  COMMISSIONER = 'commissioner',
  MEMBER = 'member',
}

export interface League {
  id: string;
  name: string;
  sport: LeagueSport;
  status: LeagueStatus;
  commissioner_id: string;
  invite_code: string;
  min_bets_per_week: number;
  min_active_weeks_pct: number;
  season_name: string | null;
  season_start: string;
  season_end: string;
  max_members: number;
  created_at: string;
}

export interface LeagueMember {
  user_id: string;
  username: string;
  avatar_url: string | null;
  role: LeagueMemberRole;
  season_score: number;
  active_weeks: number;
  total_weeks: number;
  total_bets_in_league: number;
  best_week_score: number;
  current_streak: number;
}

export interface LeagueWeeklyScore {
  user_id: string;
  username: string;
  week_number: number;
  score: number;
  bets_placed: number;
  wins: number;
  losses: number;
  roi: number;
  met_minimum: boolean;
}

export const LEAGUE_FREE_LIMIT = 2;
export const LEAGUE_MAX_PER_USER = 10;

// ── Constants ────────────────────────────────────────────────

export const SCORE_WEIGHTS = {
  WIN_RATE: 0.40,
  ROI: 0.40,
  CLV: 0.10,
  STAKE_CONSISTENCY: 0.05,
  VOLUME: 0.03,
  DIVERSITY: 0.02,
} as const;

export const RECENCY_WEIGHTS = {
  LAST_30_DAYS: 1.0,
  DAYS_31_90: 0.75,
  DAYS_91_180: 0.50,
  OLDER: 0.25,
} as const;

export const MIN_BETS_TO_UNLOCK = 10;
export const MIN_BETS_FOR_INSIGHTS = 20;
export const MAX_DAILY_SCORE_DROP = 5;
export const TRIAL_DAYS = 14;
export const SUBSCRIPTION_PRICE_CENTS = 899;
export const GRACE_PERIOD_DAYS = 3;
export const DATA_RETENTION_DAYS = 30;
export const REFERRAL_BONUS_DAYS = 3;

export const SCORE_TIER_RANGES: Record<ScoreTier, { min: number; max: number; color: string }> = {
  [ScoreTier.RECREATIONAL]: { min: 0, max: 40, color: '#ef5350' },
  [ScoreTier.DEVELOPING]: { min: 41, max: 60, color: '#FFD700' },
  [ScoreTier.SHARP]: { min: 61, max: 75, color: '#81c784' },
  [ScoreTier.ELITE]: { min: 76, max: 90, color: '#4caf50' },
  [ScoreTier.LEGEND]: { min: 91, max: 100, color: '#FFD700' },
};

export function getScoreTier(score: number): ScoreTier {
  if (score <= 40) return ScoreTier.RECREATIONAL;
  if (score <= 60) return ScoreTier.DEVELOPING;
  if (score <= 75) return ScoreTier.SHARP;
  if (score <= 90) return ScoreTier.ELITE;
  return ScoreTier.LEGEND;
}

export function getTierColor(score: number): string {
  const tier = getScoreTier(score);
  return SCORE_TIER_RANGES[tier].color;
}

export const BRAND = {
  primaryBg: '#0f2912',
  secondaryBg: '#1a3d1f',
  cardBg: '#163a1a',
  accentGreen: '#4caf50',
  lightAccent: '#81c784',
  white: '#FFFFFF',
  lightGray: '#e0e0e0',
  midGray: '#9e9e9e',
  redLoss: '#ef5350',
  greenWin: '#66bb6a',
  gold: '#FFD700',
} as const;

// ── Feature: Live Bet Slip Sharing ──────────────────────────

export enum BetSlipStatus {
  LIVE = 'live',
  WON = 'won',
  LOST = 'lost',
  PUSHED = 'pushed',
  VOID = 'void',
}

export enum SlipReactionType {
  FIRE = 'fire',
  SKULL = 'skull',
  MONEY = 'money',
  CLOWN = 'clown',
  GOAT = 'goat',
}

export interface BetSlip {
  id: string;
  user_id: string;
  bet_id: string | null;
  title: string;
  description: string | null;
  sport: Sport;
  bet_type: BetType;
  selection: string;
  odds: number;
  stake: number;
  platform: Platform;
  status: BetSlipStatus;
  event_name: string | null;
  parlay_legs: number | null;
  profit_loss: number | null;
  views_count: number;
  shares_count: number;
  is_public: boolean;
  shared_at: string;
  settled_at: string | null;
}

export interface BetSlipReaction {
  id: string;
  slip_id: string;
  user_id: string;
  reaction: SlipReactionType;
  created_at: string;
}

// ── Feature: Tail This / Capper Marketplace ─────────────────

export enum CapperStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

export enum CapperSubStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export interface CapperProfile {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  price_cents: number;
  is_active: boolean;
  total_subscribers: number;
  total_tails: number;
  total_earnings_cents: number;
  verified_at: string;
  verified_score: number;
}

export interface CapperSubscription {
  id: string;
  capper_user_id: string;
  subscriber_user_id: string;
  status: CapperSubStatus;
  price_cents: number;
  stripe_subscription_id: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface TailEvent {
  id: string;
  slip_id: string;
  capper_user_id: string;
  tailer_user_id: string;
  created_at: string;
}

// Capper tier thresholds
export const CAPPER_VERIFIED_MIN_SCORE = 75;
export const CAPPER_VERIFIED_MIN_BETS = 50;
export const CAPPER_ELITE_MIN_SCORE = 85;
export const CAPPER_ELITE_MIN_BETS = 100;

// Creator revenue share (default for new cappers)
export const CAPPER_DEFAULT_PLATFORM_FEE = 0.20;
export const CAPPER_DEFAULT_PRICE_CENTS = 499;

// Predefined creator plan types with fee percentages
export const CREATOR_PLAN_TYPES: Record<string, { label: string; fee_pct: number }> = {
  standard: { label: 'Standard Creator', fee_pct: 0.20 },
  early_creator: { label: 'Early Creator', fee_pct: 0.10 },
  founding_creator: { label: 'Founding Creator', fee_pct: 0.05 },
  partner: { label: 'Partner Creator', fee_pct: 0.10 },
  ambassador: { label: 'Ambassador Creator', fee_pct: 0.15 },
};

export type CapperTier = 'capper' | 'verified' | 'elite';
export type CreatorPlanType = keyof typeof CREATOR_PLAN_TYPES;

// Legacy exports for backward compatibility
export const CAPPER_MIN_SCORE = CAPPER_VERIFIED_MIN_SCORE;
export const CAPPER_MIN_BETS = CAPPER_VERIFIED_MIN_BETS;
export const CAPPER_PLATFORM_RAKE = CAPPER_DEFAULT_PLATFORM_FEE;
export const CAPPER_SCORE_WARNING_THRESHOLD = 70;

// ── Feature: Cash Leagues ───────────────────────────────────

export enum CashLeaguePayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface CashLeagueConfig {
  buy_in_cents: number;
  rake_pct: number;
  prize_pool_cents: number;
  is_cash_league: boolean;
  payout_status: CashLeaguePayoutStatus;
}

export interface LeagueEntry {
  id: string;
  league_id: string;
  user_id: string;
  buy_in_paid_cents: number;
  payout_cents: number;
  stripe_payment_id: string | null;
  paid_at: string;
  payout_at: string | null;
}

export const CASH_LEAGUE_RAKE_PCT = 10;
export const CASH_LEAGUE_MIN_BUY_IN_CENTS = 500;
export const CASH_LEAGUE_MAX_BUY_IN_CENTS = 50000;

// ── Feature: Head-to-Head Challenges ────────────────────────

export enum ChallengeStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  SETTLED = 'settled',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export interface Challenge {
  id: string;
  challenger_id: string;
  challengee_id: string;
  sport: Sport;
  event_name: string;
  event_start_time: string | null;
  challenger_pick: string;
  challengee_pick: string | null;
  status: ChallengeStatus;
  winner_id: string | null;
  message: string | null;
  stake_display: string | null;
  settled_at: string | null;
  expires_at: string;
  created_at: string;
}

export const H2H_CHALLENGE_EXPIRY_HOURS = 48;
export const H2H_MAX_ACTIVE_CHALLENGES = 10;
