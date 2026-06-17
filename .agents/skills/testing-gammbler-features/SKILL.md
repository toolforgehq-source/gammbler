---
name: testing-gammbler-features
description: Test Gammbler web app features end-to-end. Use when verifying new UI pages, dashboard features, landing page sections, or bet-related functionality.
---

# Testing Gammbler Features

## Architecture Overview
- **Monorepo:** `apps/web` (Next.js), `apps/api` (Express + Drizzle ORM + PostgreSQL), `apps/mobile` (Expo/React Native)
- **Frontend hosting:** Vercel (gammbler.com)
- **API hosting:** Render (api.gammbler.com)
- **Auth:** JWT stored in `localStorage` keys `gammbler_token` and `gammbler_user`

## Environment Setup

### 1. Local API Server (for testing new backend endpoints)
When testing features that add new API endpoints or DB tables, run the API locally instead of pointing to production:
```bash
cd /home/ubuntu/repos/gammbler/apps/api
# Run migrations first if new tables were added
npx tsx src/db/migrate.ts
# Start API server
npx tsx src/index.ts
```
The API runs at `http://localhost:4000`.

### 2. Dev Server
```bash
cd /home/ubuntu/repos/gammbler
# Point to LOCAL API for testing new endpoints:
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api" > apps/web/.env.local
# Or point to PRODUCTION API for frontend-only testing:
# echo "NEXT_PUBLIC_API_URL=https://api.gammbler.com/api" > apps/web/.env.local
# Start dev server
(cd apps/web && npm run dev)
```
The dev server runs at `http://localhost:3000`.

**Important:** When testing new backend features (new API routes, new DB tables), you MUST use the local API. The Vercel preview deployment points to production API which won't have unreleased changes.

### 3. Chrome CDP Connection
Chrome is already running. Find the CDP port:
```bash
cat /home/ubuntu/.browser_data_dir/DevToolsActivePort | head -1
```
Use this port for Playwright connections:
```javascript
const browser = await chromium.connectOverCDP('http://127.0.0.1:<CDP_PORT>');
const page = browser.contexts()[0].pages()[0];
```

### 4. Authentication via Browser Tool or Playwright
Use the browser tool to sign in through the UI form at `/signin`. Alternatively, create a test account via the API:
```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"TestPass123!","username":"testuser"}'
```

**Important:** Do NOT inject auth tokens directly into localStorage via `browser.console` — they won't persist across navigations. Use the sign-in form instead.

### 5. Simulating Free vs Pro Users
Modify `localStorage` via Playwright to change user tier:
```javascript
// Simulate free user
await page.evaluate(() => {
  const user = JSON.parse(localStorage.getItem('gammbler_user'));
  user.subscription_status = 'expired';
  delete user.tier;
  localStorage.setItem('gammbler_user', JSON.stringify(user));
});

// Restore to Pro/trialing
await page.evaluate(() => {
  const user = JSON.parse(localStorage.getItem('gammbler_user'));
  user.subscription_status = 'trialing';
  localStorage.setItem('gammbler_user', JSON.stringify(user));
});
```
After modifying localStorage, navigate to the target page to pick up the change.

## Testing Approach

### What CAN be tested with local API:
- All frontend UI rendering, navigation, page structure
- API CRUD operations (create/read/update/delete)
- CSV file uploads (DFS import, sports bet import)
- Feed likes and comments
- Verification badge display
- Form fields and validation UI
- Conditional rendering based on user tier (free vs pro)

### What CANNOT be tested without external services:
- SharpSports sportsbook sync (requires API key)
- Stripe payment processing (requires live keys)
- SendGrid email delivery (requires verified domain)
- OpenAI screenshot parsing (requires API key)

### PostgreSQL Type Casting Gotcha
PostgreSQL `count(*)` returns a string, not a number. So `"9" + 1 = "91"` instead of `10`. Always use `::int` cast in SQL aggregate queries:
```sql
SELECT count(*)::int as total FROM table_name
```
This has caused bugs in rankings and verification stats. Always check for this pattern when reviewing new SQL queries.

### CSV Import Testing
When testing CSV import, create test files with real-world formatting:
- Include `$` signs in monetary values (`$5.00`, `$10.00`)
- Use column names with spaces (`Entry Fee`, `Contest Entries`)
- Include commas in large numbers (`$1,500.00`)
Test file example:
```csv
Sport,Date,Contest,Places Paid,Entry Fee,Winnings,Contest Entries,Entry Count,Place,Points
NFL,01/05/2026,"NFL $5 Double Up",50,$5.00,$10.00,100,1,12,155.80
```

### Landing Page Gotcha
New landing page sections may use CSS scroll-triggered animations (`opacity: 0` until scrolled into view). The browser tool marks these as `devin-hidden`. Use `grep` on the full HTML file to verify DOM presence:
```bash
grep -oP '(Section Text|Another Text)' /tmp/page_html_*.html | sort | uniq -c
```

### Playwright Screenshot Timeout
Playwright `page.screenshot()` may timeout on font loading. Use the browser tool's built-in screenshot capability instead, or set `{ timeout: 5000 }` on the screenshot call.

### React Date Input Gotcha
React date inputs (`<input type="date">`) are controlled components. Setting the value via `document.querySelector(...).value = '...'` and dispatching events will NOT update React state. Even using `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` may not work reliably. **Workaround:** Reload the page and type the date fresh using the browser tool's `type` action, or use keyboard-based input (type `MMDDYYYY` after clicking the date field).

### Signup Form Testing (Age Verification)
The signup form at `/signup` now requires:
- Email, Username, Date of Birth (date picker), Password
- Age confirmation checkbox ("I confirm I am at least 18...")
- TOS agreement checkbox (links to /terms, /privacy, /responsible-gambling)
- Both checkboxes must be checked AND DOB must indicate 18+ for the submit button to enable

To test the age gate:
1. Type an under-18 DOB (e.g., `06012015` for June 1, 2015) → red error appears, button stays disabled
2. Reload page, type a valid 18+ DOB (e.g., `01152000` for Jan 15, 2000) → no error, button enables after checking both boxes

The signup API (`POST /auth/signup`) now requires `date_of_birth` (format `YYYY-MM-DD`) and returns 403 if under 18.

## Key Pages to Test
| Page | URL | Key Elements |
|---|---|---|
| Dashboard | `/dashboard` | Gammbler Score, Record, ROI, P/L, Streak, National Rank, Legal disclaimer footer |
| DFS Score | `/dashboard/dfs` | DFS scores, Add Contest, Import CSV, Contests tab, Leaderboards tab |
| Bet Slips | `/dashboard/slips` | "LIVE BET SLIPS" heading, SHARE A BET button, sport/status filters |
| Cappers | `/dashboard/cappers` | "CAPPER MARKETPLACE", tier info banner (CAPPER/VERIFIED/ELITE), tier filter (All/Verified/Elite), sort buttons |
| Add Bet | `/dashboard/add-bet` | Pre-Game Lock banner (free users only), form fields |
| Feed | `/dashboard/feed` | Community feed with heart (like) and comment icons per item |
| Leaderboards | `/dashboard/leaderboards` | Sport tabs, Friends/National toggle |
| Leagues | `/dashboard/leagues` | Join/Create buttons, empty state |
| Profile | `/dashboard/profile` | Score, capper tier badge (CAPPER/VERIFIED/ELITE), verification badge (shield icon + "X% Verified"), badges, DFS section |
| Landing | `/` | Feature sections, hero, leaderboard preview |
| Signup | `/signup` | DOB field, age confirmation checkbox, TOS checkbox, "not a sportsbook" disclaimer |
| Terms | `/terms` | 14-section TOS, "NOT a sportsbook" in Section 1, gambling disclaimer in Section 8 |
| Privacy | `/privacy` | 12-section policy, CCPA section, children's privacy, "NOT sell" statement |
| Responsible Gambling | `/responsible-gambling` | NCPG helpline (1-800-522-4700), warning signs, GA link |

## CI Notes
- `gammbler` on Vercel (web frontend): Should pass
- `gammbler-api` on Vercel: Will fail — this is **expected** since API runs on Render, not Vercel. Marked as optional.

### Capper System Testing
The capper system uses a tiered model: Member → Capper → Verified Capper → Elite Capper.
- **Any user can become a capper** — no score requirement. Test by creating a fresh user with 0 bets and applying.
- Tier badges show on cappers page, profile, slips, and leaderboards.
- Profile page: capper tier badge renders independently of score unlock status. If the badge is missing for new cappers, check if it's accidentally nested inside the `overallScore?.is_unlocked` conditional.
- Tier filters on `/dashboard/cappers`: "Verified" and "Elite" filters may return empty results if no cappers meet those thresholds — this is expected behavior, not a bug.
- Revenue share text should say "80%" (creator keeps) and "20%" (platform fee). Old values were 70%/30%.
- Landing page FAQ and `/terms` Section 5 should reflect the updated percentages.
- The signup API requires `tos_accepted: true` and `date_of_birth` fields (added in PR #13).

### Profile Route Gotcha
The profile API uses username-based routing (`/api/profile/:username`), not `/api/profile/me`. The frontend fetches the logged-in user's profile by their username. If you test via curl, use the username path.

### Full Platform E2E Test Checklist
When doing a comprehensive "launch readiness" audit, test these 14 flows in sequence:
1. Landing page (hero, 6 sections, social proof, CTAs → /signup)
2. Fresh user signup (age verification, TOS, redirect to dashboard)
3. Bet entry → score generation (need 10+ settled bets to unlock score)
4. Sportsbook connection UI (8 platforms, VerifiedScorePassModal with 3 options)
5. Leaderboard + national ranking (user appears with correct rank, profile links work)
6. H2H challenge creation (requires `challengee_username`, `event_name`, `challenger_pick`)
7. League creation (requires `season_start`, `season_end` field names, not `start_date`/`end_date`)
8. Creator flow — becoming a capper requires 50+ settled bets, then create public + subscriber-only posts
9. Creator Discovery + Rankings (5 sections, sport filtering)
10. Verified Score Pass Stripe checkout ($4.99 one-time via `/api/stripe/create-verified-pass-checkout`)
11. Profile completeness (score, record, ROI, P/L, sport scores, badges, Share Score Card)
12. Community feed (activity entries, like button increments)
13. Mobile responsiveness (viewport meta, Tailwind responsive classes)
14. Cross-feature integration (score consistency across leaderboard, scores, and profile APIs)

### API Field Name Gotchas
- **Challenge creation:** Uses `challengee_username`, `event_name`, `challenger_pick` (not `opponent_id`, `your_pick`)
- **League creation:** Uses `season_start`, `season_end` (not `start_date`, `end_date`)
- **Leaderboard API:** Route is `/api/leaderboards/:sport/national` (not `/api/leaderboards?scope=national`)
- **Stripe verified pass:** Route is `/api/stripe/create-verified-pass-checkout` (POST with auth token)

### SharpSports Testing Limitation
The dev/testing SharpSports API key has read-only access:
- `GET /v1/books/` → 200 (lists 30+ sportsbooks) ✓
- `POST /v1/context/` → 403 (cannot create OAuth contexts) ✗
This means the full OAuth sportsbook connection flow cannot be tested with the dev key. Test the UI flow and modal, then verify downstream pipeline (verified badge, leaderboard display) separately. A production key is needed for real sportsbook connections.

### Stripe Checkout Testing
The Stripe checkout creates real `cs_test_` sessions when using the test key. Clicking the "Verified Score Pass" option in the modal may timeout in the browser because it redirects to `checkout.stripe.com`. Verify the API directly instead:
```bash
curl -s http://localhost:4000/api/stripe/create-verified-pass-checkout \
  -X POST -H "Authorization: Bearer $TOKEN" | jq '.url'
```
Expected: URL starting with `https://checkout.stripe.com/c/pay/cs_test_...`

### Capper Application Bet Threshold
Becoming a capper requires 50+ settled bets (enforced in `/api/cappers/apply`). When testing the creator flow, you may need to add extra bets first:
```bash
for i in $(seq 1 30); do
  curl -s http://localhost:4000/api/bets -X POST \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"sport\":\"nfl\",\"bet_type\":\"spread\",\"platform\":\"draftkings\",\"selection\":\"Team $i -3.5\",\"odds\":-110,\"stake\":20,\"result\":\"win\",\"profit_loss\":\"18.18\"}" > /dev/null
done
```

### Drizzle ORM Array Gotcha
Raw SQL `ANY($1)` does not accept JavaScript arrays in drizzle-orm. Use `inArray()` from drizzle-orm instead:
```typescript
// BAD: sql`column = ANY(${arrayValue})`
// GOOD: inArray(table.column, arrayValue)
```

### Migration File Completeness
When adding new DB tables via schema changes, ensure the `migrate.ts` raw SQL file includes CREATE TABLE statements for all new tables. The schema definition alone is not sufficient — the migration runner needs explicit SQL.

### Password Reset Flow Testing
Test the full forgot-password → reset-password → signin cycle via shell:
1. `POST /auth/forgot-password` with valid email → always returns generic success message
2. `POST /auth/forgot-password` with fake email → **must return identical response** (anti-enumeration)
3. Get the reset token from DB: `SELECT password_reset_token FROM users WHERE email='...'`
4. `POST /auth/reset-password` with `{"token":"<db_token>","password":"NewPass!"}` → success
5. Verify token cleared: `SELECT password_reset_token IS NULL FROM users WHERE email='...'` → true
6. Sign in with new password → should work
7. Test invalid/expired token → 400 `"Invalid or expired reset token"`
8. **Reset password back** to original after testing

Frontend pages: `/forgot-password` (email form), `/reset-password?token=xxx` (new password form), "Forgot password?" link on `/signin`.

### Email Verification Testing
Test the signup → verify flow via shell:
1. After signup, check DB: `SELECT email_verified, email_verification_token IS NOT NULL FROM users WHERE email='...'` → `false, true`
2. Get token: `SELECT email_verification_token FROM users WHERE email='...'`
3. `GET /auth/verify-email?token=<db_token>` → 200 `"Email verified successfully!"`
4. Check DB updated: `email_verified=true`, `email_verification_token IS NULL`
5. `GET /auth/me` with user's JWT → response includes `"email_verified": true`
6. Invalid token → 400 `"Invalid verification token"`
7. `POST /auth/resend-verification` (authed) → regenerates token and resends email

Frontend page: `/verify-email?token=xxx` auto-verifies on mount.

### Onboarding Card Testing
The onboarding card shows on dashboard when `is_unlocked=false` (user has < 10 settled bets).
- **Fresh user assertions:** "Get Your Gammbler Score" heading, three paths (Connect Sportsbook/Fastest, Upload CSV/Quick, Add Bets/Manual), progress bar "0/10 bets", "How Your Score Works" expandable section with tier breakdown (Legend 90+, Elite 80+, Sharp 70+, Developing 60+, Recreational 0+) and factors (ROI, consistency, volume, recency)
- **Scored user assertion:** Onboarding card must NOT appear for users with unlocked scores

### Leaderboard Challenge Button Testing
- Navigate to `/dashboard/leaderboards` → NATIONAL tab
- Non-self rows should have "Challenge" button (sword icon)
- Self row (marked with "(You)") should NOT have a Challenge button
- Clicking Challenge → navigates to `/dashboard/challenges?opponent=USERNAME`
- Challenge creation form auto-opens with opponent pre-populated from URL param

### Stats API Testing
`GET /api/stats/public` returns live DB counts `{users, bets, challenges, leagues}`. Verify against actual DB:
```sql
SELECT (SELECT count(*)::int FROM users) as users, (SELECT count(*)::int FROM bets) as bets, (SELECT count(*)::int FROM challenges) as challenges, (SELECT count(*)::int FROM leagues) as leagues;
```
Landing page should NOT contain hardcoded values ("42,391", "1.2M+", "89,400", "6,200").

### API Server Restart Gotcha
If the API server was started in a previous session, it may be running old code. New routes will return 404. Kill and restart:
```bash
fuser -k 4000/tcp 2>/dev/null; sleep 1
cd /home/ubuntu/repos/gammbler/apps/api && nohup npx tsx src/index.ts > /tmp/api.log 2>&1 &
```
Note: `lsof` may not be available — use `fuser` instead.

## Devin Secrets Needed
- `SHARPSPORTS_API_KEY` — sportsbook sync (SharpSports)
- `STRIPE_SECRET_KEY` + `WEBHOOK_SIGNING_SECRET` — payments (Stripe)
- `SENDGRID_API_KEY` — transactional emails
- `THE_ODDS_API_KEY` — odds data
- For local-only testing without external services: no secrets required
