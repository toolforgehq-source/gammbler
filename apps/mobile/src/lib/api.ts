import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('gammbler_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

export const authAPI = {
  signup: (data: { email: string; password: string; username: string; tos_accepted: boolean; referral_code?: string }) =>
    api.post('/auth/signup', data),
  signin: (data: { email: string; password: string }) =>
    api.post('/auth/signin', data),
  me: () => api.get('/auth/me'),
  checkUsername: (username: string) =>
    api.post('/auth/check-username', { username }),
};

export const scoresAPI = {
  getAll: () => api.get('/scores'),
  getBySport: (sport: string) => api.get(`/scores/${sport}`),
};

export const betsAPI = {
  list: (params?: Record<string, string>) => api.get('/bets', { params }),
  create: (data: Record<string, unknown>) => api.post('/bets', data),
  stats: (params?: Record<string, string>) => api.get('/bets/stats', { params }),
};

export const leaderboardsAPI = {
  friends: (sport: string) => api.get(`/leaderboards/${sport}/friends`),
  national: (sport: string) => api.get(`/leaderboards/${sport}/national`),
};

export const feedAPI = {
  get: (params?: Record<string, string>) => api.get('/feed', { params }),
};

export const profileAPI = {
  get: (username: string) => api.get(`/profile/${username}`),
  update: (data: Record<string, unknown>) => api.patch('/profile', data),
  follow: (userId: string) => api.post(`/profile/follow/${userId}`),
  unfollow: (userId: string) => api.delete(`/profile/follow/${userId}`),
};

export const badgesAPI = {
  getAll: () => api.get('/badges/all'),
};

export const insightsAPI = {
  get: () => api.get('/insights'),
};

export const notificationsAPI = {
  list: () => api.get('/notifications'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
};

export const connectionsAPI = {
  list: () => api.get('/connections'),
  initiate: (platform: string) => api.post('/connections/initiate', { platform }),
  sync: (platform: string) => api.post(`/connections/${platform}/sync`),
  disconnect: (platform: string) => api.delete(`/connections/${platform}`),
};

export const stripeAPI = {
  createCheckout: () => api.post('/stripe/create-checkout'),
  createPortal: () => api.post('/stripe/create-portal'),
};

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
  weekly: (id: string, week?: number) => api.get(`/leagues/${id}/weekly`, { params: week ? { week } : undefined }),
  awards: (id: string) => api.get(`/leagues/${id}/awards`),
};
