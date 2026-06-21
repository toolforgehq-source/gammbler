import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import cron from 'node-cron';
import { checkTrialReminders, sendWeeklyReports } from './services/scheduled-emails';
import { snapshotAllScores } from './services/score-snapshots';
import { snapshotAllDfsScores } from './services/dfs-score-snapshots';
import { runDailyBrainCycle, initializeGrowthBrain } from './services/growth-brain';
import { captureFunnelSnapshot } from './services/funnel-snapshot';

// Routes
import authRoutes from './routes/auth';
import betRoutes from './routes/bets';
import scoreRoutes from './routes/scores';
import leaderboardRoutes from './routes/leaderboards';
import feedRoutes from './routes/feed';
import profileRoutes from './routes/profile';
import notificationRoutes from './routes/notifications';
import stripeRoutes from './routes/stripe';
import connectionRoutes from './routes/connections';
import insightRoutes from './routes/insights';
import badgeRoutes from './routes/badges';
import shareableRoutes from './routes/shareable';
import leagueRoutes from './routes/leagues';
import slipRoutes from './routes/slips';
import capperRoutes from './routes/cappers';
import seedRoutes from './routes/seed';
import challengeRoutes from './routes/challenges';
import dfsRoutes from './routes/dfs';
import creatorPostRoutes from './routes/creator-posts';
import creatorLeaderboardRoutes from './routes/creator-leaderboards';
import creatorBadgeRoutes from './routes/creator-badges';
import creatorDiscoveryRoutes from './routes/creator-discovery';
import statsRoutes from './routes/stats';
import growthBrainRoutes from './routes/growth-brain';
import publicRoutes from './routes/public';

const app = express();
const server = createServer(app);

// Socket.IO for real-time feed
const io = new SocketServer(server, {
  cors: { origin: env.CORS_ORIGIN, methods: ['GET', 'POST'] },
});

// ── Middleware ────────────────────────────────────────────────

// Stripe webhook needs raw body
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

app.use(helmet());
app.use(compression());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', limiter);

// ── Routes ───────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/leaderboards', leaderboardRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/insights', insightRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/shareable', shareableRoutes);
app.use('/api/leagues', leagueRoutes);
app.use('/api/slips', slipRoutes);
app.use('/api/cappers', capperRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/dfs', dfsRoutes);
app.use('/api/creator-posts', creatorPostRoutes);
app.use('/api/creator-leaderboards', creatorLeaderboardRoutes);
app.use('/api/creator-badges', creatorBadgeRoutes);
app.use('/api/creator-discovery', creatorDiscoveryRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/growth-brain', growthBrainRoutes);
app.use('/api/public', publicRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Socket.IO ────────────────────────────────────────────────

io.on('connection', (socket) => {
  const userId = socket.handshake.auth.userId;
  if (userId) {
    socket.join(`user:${userId}`);
  }

  socket.on('join-feed', () => {
    socket.join('feed');
  });

  socket.on('disconnect', () => {});
});

// Export io for use in services
export { io };

// ── Start ────────────────────────────────────────────────────

server.listen(env.PORT, () => {
  console.log(`Gammbler API running on port ${env.PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);

  // ── Scheduled email jobs ──────────────────────────────────

  // Check trial reminders every hour
  cron.schedule('0 * * * *', () => {
    checkTrialReminders().catch((err) => console.error('[Cron] Trial reminder error:', err));
  });

  // Send weekly reports every Monday at 9am UTC
  cron.schedule('0 9 * * 1', () => {
    sendWeeklyReports().catch((err) => console.error('[Cron] Weekly report error:', err));
  });

  // Snapshot all Gammbler Scores daily at midnight UTC
  cron.schedule('0 0 * * *', () => {
    snapshotAllScores().catch((err) => console.error('[Cron] Score snapshot error:', err));
    snapshotAllDfsScores().catch((err) => console.error('[Cron] DFS score snapshot error:', err));
  });

  // Growth Brain: funnel snapshot at 6am UTC daily
  cron.schedule('0 6 * * *', () => {
    captureFunnelSnapshot().catch((err) => console.error('[Cron] Funnel snapshot error:', err));
  });

  // Growth Brain: daily brain cycle at 6:30am UTC (generate opportunities)
  cron.schedule('30 6 * * *', () => {
    runDailyBrainCycle().catch((err) => console.error('[Cron] Growth Brain cycle error:', err));
  });

  // Initialize Growth Brain beliefs on first startup
  initializeGrowthBrain().catch((err) => console.error('[Growth Brain] Init error:', err));

  console.log('Scheduled jobs registered');
});

export default app;
