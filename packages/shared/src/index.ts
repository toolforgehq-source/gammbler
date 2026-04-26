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
}

export enum FeedEventType {
  PARLAY_HIT = 'parlay_hit',
  RANK_UP = 'rank_up',
  WIN_STREAK = 'win_streak',
  BADGE_EARNED = 'badge_earned',
  SCORE_HIGH = 'score_high',
  SPORTSBOOK_CONNECTED = 'sportsbook_connected',
  WEEKLY_LEADER = 'weekly_leader',
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
