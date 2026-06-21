const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function publicFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/public${path}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface LeaderboardResponse {
  sport: string;
  page: number;
  total: number;
  total_pages: number;
  leaderboard: Array<{
    rank: number;
    username: string;
    avatar_url: string | null;
    score: number;
    tier: string;
    win_rate: number | null;
    roi: number | null;
    settled_bet_count: number;
  }>;
}

export interface PublicProfile {
  username: string;
  avatar_url: string | null;
  member_since: string;
  overall_score: number;
  tier: string;
  national_rank: number | null;
  record: { wins: number; losses: number; pushes: number };
  roi: number | null;
  win_rate: number | null;
  followers: number;
  scores: Array<{
    sport: string;
    score: number;
    tier: string;
    win_rate: number | null;
    roi: number | null;
    settled_bet_count: number;
  }>;
  badges: Array<{ badge_type: string; earned_at: string }>;
}

export interface CreatorListResponse {
  total: number;
  creators: Array<{
    username: string;
    avatar_url: string | null;
    display_name: string;
    bio: string | null;
    verified_score: number | null;
    favorite_sports: unknown;
    total_subscribers: number;
    total_followers: number;
  }>;
}

export interface CreatorProfile {
  username: string;
  avatar_url: string | null;
  display_name: string;
  bio: string | null;
  banner_url: string | null;
  profile_photo_url: string | null;
  verified_score: number | null;
  favorite_sports: unknown;
  favorite_teams: unknown;
  betting_style: string | null;
  social_links: unknown;
  total_subscribers: number;
  total_followers: number;
  total_tails: number;
  record: { wins: number; losses: number; pushes: number };
  scores: Array<{
    sport: string;
    score: number;
    tier: string;
    win_rate: number | null;
    roi: number | null;
    settled_bet_count: number;
  }>;
}

export interface StatsResponse {
  total_users: number;
  total_bets: number;
  total_settled_bets: number;
  scored_users: number;
  avg_score: number | null;
  avg_win_rate: number | null;
  avg_roi: number | null;
  profitable_bettors: number;
  profitable_percentage: number | null;
  score_distribution: Array<{ range: string; count: number }>;
  sport_breakdown: Array<{
    sport: string;
    avg_score: number | null;
    avg_win_rate: number | null;
    avg_roi: number | null;
    total_scored: number;
  }>;
  bet_type_distribution: Array<{ bet_type: string; total: number }>;
}

export interface SportStatsResponse {
  sport: string;
  total_bets: number;
  scored_users: number;
  avg_score: number | null;
  avg_win_rate: number | null;
  avg_roi: number | null;
  profitable_bettors: number;
  profitable_percentage: number | null;
  bet_type_distribution: Array<{ bet_type: string; total: number }>;
  top_performers: Array<{
    rank: number;
    username: string;
    score: number;
    tier: string;
    win_rate: number | null;
    roi: number | null;
    settled_bet_count: number;
  }>;
}

export interface SitemapDataResponse {
  public_usernames: string[];
  creator_usernames: string[];
}
