import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('gammbler_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gammbler_token');
        localStorage.removeItem('gammbler_user');
        window.location.href = '/signin';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const authAPI = {
  signup: (data: { email: string; password: string; username: string; date_of_birth: string; tos_accepted: boolean; referral_code?: string }) =>
    api.post('/auth/signup', data),
  signin: (data: { email: string; password: string }) =>
    api.post('/auth/signin', data),
  me: () => api.get('/auth/me'),
  checkUsername: (username: string) =>
    api.post('/auth/check-username', { username }),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
  verifyEmail: (token: string) =>
    api.get(`/auth/verify-email?token=${token}`),
  resendVerification: () =>
    api.post('/auth/resend-verification'),
};

// Bets
export const betsAPI = {
  list: (params?: Record<string, string>) => api.get('/bets', { params }),
  create: (data: Record<string, unknown>) => api.post('/bets', data),
  settle: (id: string, result: string) => api.patch(`/bets/${id}/settle`, { result }),
  csvImport: (file: File, platform: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('platform', platform);
    return api.post('/bets/csv-import', form, { headers: { 'Content-Type': undefined } });
  },
  stats: (params?: Record<string, string>) => api.get('/bets/stats', { params }),
  upcomingEvents: (sport: string) => api.get('/bets/upcoming-events', { params: { sport } }),
  parseScreenshot: (file: File) => {
    const form = new FormData();
    form.append('screenshot', file);
    return api.post('/bets/parse-screenshot', form, { headers: { 'Content-Type': undefined } });
  },
};

// Scores
export const scoresAPI = {
  getAll: () => api.get('/scores'),
  getBySport: (sport: string) => api.get(`/scores/${sport}`),
  getForUser: (userId: string) => api.get(`/scores/user/${userId}`),
  getMyRank: () => api.get('/scores/my-rank'),
  getVerification: (userId: string) => api.get(`/scores/verification/${userId}`),
};

// Leaderboards
export const leaderboardsAPI = {
  friends: (sport: string) => api.get(`/leaderboards/${sport}/friends`),
  national: (sport: string, params?: Record<string, string>) =>
    api.get(`/leaderboards/${sport}/national`, { params }),
};

// Creator Leaderboards
export const creatorLeaderboardsAPI = {
  get: (category: string, params?: Record<string, string>) =>
    api.get('/creator-leaderboards', { params: { category, ...params } }),
};

// Creator Badges
export const creatorBadgesAPI = {
  getDefinitions: () => api.get('/creator-badges/definitions'),
  getForUser: (userId: string) => api.get(`/creator-badges/${userId}`),
  check: () => api.post('/creator-badges/check'),
};

// Creator Discovery
export const creatorDiscoveryAPI = {
  get: (section: string, params?: Record<string, string>) =>
    api.get('/creator-discovery', { params: { section, ...params } }),
};

// Feed
export const feedAPI = {
  get: (params?: Record<string, string>) => api.get('/feed', { params }),
  like: (eventId: string) => api.post(`/feed/${eventId}/like`),
  unlike: (eventId: string) => api.delete(`/feed/${eventId}/like`),
  getComments: (eventId: string) => api.get(`/feed/${eventId}/comments`),
  addComment: (eventId: string, text: string) => api.post(`/feed/${eventId}/comments`, { text }),
};

// Profile
export const profileAPI = {
  get: (username: string) => api.get(`/profile/${username}`),
  update: (data: Record<string, unknown>) => api.patch('/profile', data),
  follow: (userId: string) => api.post(`/profile/follow/${userId}`),
  unfollow: (userId: string) => api.delete(`/profile/follow/${userId}`),
  scoreHistory: (username: string) => api.get(`/profile/${username}/score-history`),
};

// Notifications
export const notificationsAPI = {
  list: (params?: Record<string, string>) => api.get('/notifications', { params }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};

// Stripe
export const stripeAPI = {
  createCheckout: () => api.post('/stripe/create-checkout'),
  createPortal: () => api.post('/stripe/create-portal'),
  createVerifiedPassCheckout: () => api.post('/stripe/create-verified-pass-checkout'),
};

// Connections
export const connectionsAPI = {
  list: () => api.get('/connections'),
  initiate: (platform: string) => api.post('/connections/initiate', { platform }),
  complete: (platform: string, sharpsports_account_id: string) =>
    api.post('/connections/complete', { platform, sharpsports_account_id }),
  sync: (platform: string) => api.post(`/connections/${platform}/sync`),
  disconnect: (platform: string) => api.delete(`/connections/${platform}`),
};

// Insights
export const insightsAPI = {
  get: () => api.get('/insights'),
  weeklyReport: () => api.get('/insights/weekly-report'),
  weeklyReports: () => api.get('/insights/weekly-reports'),
};

// Badges
export const badgesAPI = {
  get: () => api.get('/badges'),
  getAll: () => api.get('/badges/all'),
};

// Bet Slips (Live Bet Slip Sharing)
export const slipsAPI = {
  feed: (params?: Record<string, string>) => api.get('/slips', { params }),
  mine: (params?: Record<string, string>) => api.get('/slips/mine', { params }),
  get: (id: string) => api.get(`/slips/${id}`),
  create: (data: {
    title: string;
    description?: string;
    sport: string;
    bet_type: string;
    selection: string;
    odds: number;
    stake: number;
    platform: string;
    event_name?: string;
    parlay_legs?: number;
    bet_id?: string;
    is_public?: boolean;
  }) => api.post('/slips', data),
  settle: (id: string, data: { result: string; profit_loss?: number }) =>
    api.patch(`/slips/${id}/settle`, data),
  react: (id: string, reaction: string) => api.post(`/slips/${id}/react`, { reaction }),
  share: (id: string) => api.post(`/slips/${id}/share`),
  cardUrl: (id: string) => `${api.defaults.baseURL}/slips/${id}/card`,
  delete: (id: string) => api.delete(`/slips/${id}`),
};

// Cappers (Tail This)
export const cappersAPI = {
  list: (params?: Record<string, string>) => api.get('/cappers', { params }),
  get: (userId: string) => api.get(`/cappers/${userId}`),
  apply: () => api.post('/cappers/apply'),
  updateProfile: (data: Record<string, unknown>) =>
    api.patch('/cappers/me', data),
  subscribe: (userId: string) => api.post(`/cappers/${userId}/subscribe`),
  unsubscribe: (userId: string) => api.delete(`/cappers/${userId}/subscribe`),
  tail: (slipId: string) => api.post(`/cappers/tail/${slipId}`),
  mySubscribers: () => api.get('/cappers/me/subscribers'),
  myEarnings: () => api.get('/cappers/me/earnings'),
};

// Creator Posts
export const creatorPostsAPI = {
  list: (params?: Record<string, string>) => api.get('/creator-posts', { params }),
  create: (data: { content: string; image_url?: string; is_subscriber_only?: boolean }) =>
    api.post('/creator-posts', data),
  like: (postId: string) => api.post(`/creator-posts/${postId}/like`),
  unlike: (postId: string) => api.delete(`/creator-posts/${postId}/like`),
  getComments: (postId: string) => api.get(`/creator-posts/${postId}/comments`),
  addComment: (postId: string, text: string) => api.post(`/creator-posts/${postId}/comments`, { text }),
  delete: (postId: string) => api.delete(`/creator-posts/${postId}`),
};

// Shareable Cards
export const shareableAPI = {
  generateCard: (sport: string = 'overall') =>
    api.post('/shareable/card', { sport }, { responseType: 'blob' }),
  cardStatus: () => api.get('/shareable/card-status'),
  h2hCard: (challenge_id: string) =>
    api.post('/shareable/h2h-card', { challenge_id }, { responseType: 'blob' }),
};

// Challenges (Head-to-Head)
export const challengesAPI = {
  list: (params?: Record<string, string>) => api.get('/challenges', { params }),
  get: (id: string) => api.get(`/challenges/${id}`),
  stats: () => api.get('/challenges/stats'),
  create: (data: {
    challengee_username: string;
    sport: string;
    event_name: string;
    event_start_time?: string;
    challenger_pick: string;
    message?: string;
    stake_display?: string;
  }) => api.post('/challenges', data),
  accept: (id: string, pick: string) => api.patch(`/challenges/${id}/accept`, { pick }),
  decline: (id: string) => api.patch(`/challenges/${id}/decline`),
  cancel: (id: string) => api.patch(`/challenges/${id}/cancel`),
  settle: (id: string, winner_id: string) => api.patch(`/challenges/${id}/settle`, { winner_id }),
  searchUsers: (q: string) => api.get('/challenges/search-users', { params: { q } }),
};

// DFS (Daily Fantasy Sports)
export const dfsAPI = {
  // Contests
  addContest: (data: {
    platform: string;
    sport: string;
    contest_type: string;
    contest_name?: string;
    entry_fee: number;
    payout: number;
    finish_position?: number;
    total_entries?: number;
    points_scored?: number;
    contest_date: string;
  }) => api.post('/dfs/contests', data),
  listContests: (params?: Record<string, string>) => api.get('/dfs/contests', { params }),
  stats: () => api.get('/dfs/stats'),

  // Scores
  getScores: () => api.get('/dfs/scores'),
  getUserScores: (userId: string) => api.get(`/dfs/scores/user/${userId}`),

  // Leaderboards
  nationalLeaderboard: (sport: string, params?: Record<string, string>) =>
    api.get(`/dfs/leaderboards/${sport}/national`, { params }),
  friendsLeaderboard: (sport: string) => api.get(`/dfs/leaderboards/${sport}/friends`),

  // Badges
  getBadges: () => api.get('/dfs/badges'),

  // Score History
  scoreHistory: (sport?: string) => api.get('/dfs/score-history', { params: sport ? { sport } : undefined }),

  // CSV Import
  csvImport: (file: File, platform: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('platform', platform);
    return api.post('/dfs/csv-import', form, { headers: { 'Content-Type': undefined } });
  },
};

// Leagues
export const leaguesAPI = {
  list: () => api.get('/leagues'),
  get: (id: string) => api.get(`/leagues/${id}`),
  create: (data: {
    name: string;
    sport: string;
    season_name?: string;
    season_start: string;
    season_end: string;
    min_bets_per_week?: number;
    max_members?: number;
  }) => api.post('/leagues', data),
  join: (invite_code: string) => api.post('/leagues/join', { invite_code }),
  leave: (id: string) => api.delete(`/leagues/${id}/leave`),
  delete: (id: string) => api.delete(`/leagues/${id}`),
  updateSettings: (id: string, data: Record<string, unknown>) => api.put(`/leagues/${id}/settings`, data),
  weekly: (id: string, week?: number) => api.get(`/leagues/${id}/weekly`, { params: week ? { week } : undefined }),
  awards: (id: string) => api.get(`/leagues/${id}/awards`),
  kick: (id: string, target_user_id: string) => api.post(`/leagues/${id}/kick`, { target_user_id }),
};
