# Gammbler — Know Your Edge

The world's first unified sports betting identity and analytics platform.

## Architecture

**Monorepo** managed with npm workspaces:

| Directory | Description |
|-----------|-------------|
| `apps/api` | Express + PostgreSQL + Redis backend |
| `apps/web` | Next.js web dashboard & marketing site |
| `apps/mobile` | React Native (Expo) mobile app |

## Core Features

- **Gammbler Score**: Proprietary 0–100 rating based on win rate (40%), ROI (40%), CLV (10%), stake consistency (5%), volume (3%), diversity (2%) with recency weighting
- **10 Sport Scores**: Overall, NFL, NBA, MLB, NHL, CFB, CBB, Soccer, PrizePicks, DFS
- **20 Leaderboards**: 10 friend-based + 10 national (per sport)
- **Community Feed**: Real-time activity feed from followed users
- **Sportsbook Sync**: SharpSports integration + CSV fallback
- **CLV Analysis**: The Odds API integration for closing line value calculation
- **Shareable Cards**: SVG → PNG score cards for social sharing
- **Achievements**: 14+ badge types with automatic awarding
- **Subscription**: Free forever tier + Stripe-managed Pro at $8.99/month

## Integrations

- **SharpSports** — Sportsbook data sync (DraftKings, FanDuel, BetMGM, Caesars, etc.)
- **The Odds API** — Closing line value data
- **Stripe** — Subscription management and billing
- **SendGrid** — Transactional email
- **Socket.IO** — Real-time feed updates

## Setup

### Prerequisites

- Node.js 22+
- PostgreSQL 15+
- Redis 7+

### Install

```bash
npm install
```

### Environment Variables

Copy `apps/api/.env.example` to `apps/api/.env` and fill in values.

### Run Backend

```bash
cd apps/api
npx tsx src/db/migrate.ts   # Run migrations
npx tsx src/index.ts         # Start server on :4000
```

### Run Web

```bash
cd apps/web
npm run dev                  # Start on :3000
```

### Run Mobile

```bash
cd apps/mobile
npx expo start
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Express, Drizzle ORM, PostgreSQL, Redis, Socket.IO |
| Web | Next.js 16, React 19, Tailwind CSS v4, Zustand |
| Mobile | React Native (Expo 54), Expo Router |
| Auth | JWT (bcryptjs) |
| Payments | Stripe |
| Score Cards | Sharp (SVG → PNG) |

## Brand

- **Primary**: #0f2912 (dark forest green)
- **Accent**: #4caf50 (bright green)
- **Fonts**: Barlow Condensed (headings), DM Sans (body), Oswald (numbers)
