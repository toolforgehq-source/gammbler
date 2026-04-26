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
  signup: (data: { email: string; password: string; username: string; tos_accepted: boolean; referral_code?: string }) =>
    api.post('/auth/signup', data),
  signin: (data: { email: string; password: string }) =>
    api.post('/auth/signin', data),
  me: () => api.get('/auth/me'),
  checkUsername: (username: string) =>
    api.post('/auth/check-username', { username }),
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
    return api.post('/bets/csv-import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  stats: (params?: Record<string, string>) => api.get('/bets/stats', { params }),
};

// Scores
export const scoresAPI = {
  getAll: () => api.get('/scores'),
  getBySport: (sport: string) => api.get(`/scores/${sport}`),
  getForUser: (userId: string) => api.get(`/scores/user/${userId}`),
};

// Leaderboards
export const leaderboardsAPI = {
  friends: (sport: string) => api.get(`/leaderboards/${sport}/friends`),
  national: (sport: string, params?: Record<string, string>) =>
    api.get(`/leaderboards/${sport}/national`, { params }),
};

// Feed
export const feedAPI = {
  get: (params?: Record<string, string>) => api.get('/feed', { params }),
};

// Profile
export const profileAPI = {
  get: (username: string) => api.get(`/profile/${username}`),
  update: (data: Record<string, unknown>) => api.patch('/profile', data),
  follow: (userId: string) => api.post(`/profile/follow/${userId}`),
  unfollow: (userId: string) => api.delete(`/profile/follow/${userId}`),
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
