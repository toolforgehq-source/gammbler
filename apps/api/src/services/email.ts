import sgMail from '@sendgrid/mail';
import { env } from '../config/env';

// Initialize SendGrid
if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

function isConfigured(): boolean {
  return !!env.SENDGRID_API_KEY;
}

// ── Brand constants ──────────────────────────────────────────

const BRAND = {
  name: 'Gammbler',
  tagline: 'Know Your Number.',
  color: '#22c55e',
  darkBg: '#0a0f0a',
  cardBg: '#111711',
  textLight: '#d1d5db',
  textMuted: '#9ca3af',
  url: env.FRONTEND_URL || 'https://gammbler.com',
  logo: `${env.FRONTEND_URL || 'https://gammbler.com'}/images/logo-main.png`,
};

// ── Base HTML wrapper ────────────────────────────────────────

function wrapHtml(content: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${BRAND.name}</title>
<style>
  body{margin:0;padding:0;background:${BRAND.darkBg};color:${BRAND.textLight};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
  .container{max-width:600px;margin:0 auto;padding:32px 24px}
  .header{text-align:center;padding:24px 0;border-bottom:1px solid #1f2f1f}
  .header img{height:40px}
  .content{padding:32px 0}
  h1{color:#fff;font-size:24px;margin:0 0 16px}
  h2{color:#fff;font-size:20px;margin:0 0 12px}
  p{color:${BRAND.textLight};font-size:16px;line-height:1.6;margin:0 0 16px}
  .btn{display:inline-block;background:${BRAND.color};color:#000;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;margin:8px 0}
  .btn:hover{background:#16a34a}
  .card{background:${BRAND.cardBg};border:1px solid #1f2f1f;border-radius:12px;padding:24px;margin:16px 0}
  .score{font-size:48px;font-weight:800;color:${BRAND.color};text-align:center}
  .stat-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1f2f1f}
  .stat-label{color:${BRAND.textMuted};font-size:14px}
  .stat-value{color:#fff;font-weight:600;font-size:14px}
  .badge-icon{font-size:32px;text-align:center;margin-bottom:8px}
  .footer{text-align:center;padding:24px 0;border-top:1px solid #1f2f1f;color:${BRAND.textMuted};font-size:12px}
  .footer a{color:${BRAND.textMuted};text-decoration:underline}
  .highlight{color:${BRAND.color};font-weight:600}
  .muted{color:${BRAND.textMuted};font-size:14px}
  @media(max-width:600px){.container{padding:16px 12px}.score{font-size:36px}}
</style>
</head>
<body>
${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${preheader}</div>` : ''}
<div class="container">
  <div class="header">
    <a href="${BRAND.url}"><img src="${BRAND.logo}" alt="${BRAND.name}" style="height:40px"/></a>
  </div>
  <div class="content">
    ${content}
  </div>
  <div class="footer">
    <p>${BRAND.name} &mdash; ${BRAND.tagline}</p>
    <p>
      <a href="${BRAND.url}">Visit Gammbler</a> &middot;
      <a href="${BRAND.url}/settings">Manage Preferences</a>
    </p>
    <p>&copy; ${new Date().getFullYear()} Gammbler Inc. All rights reserved.</p>
    <p class="muted">Gammbler is not a sportsbook and does not accept wagers.</p>
  </div>
</div>
</body>
</html>`;
}

// ── Send helper ──────────────────────────────────────────────

async function send(to: string, subject: string, html: string): Promise<boolean> {
  if (!isConfigured()) {
    console.log(`[Email] SendGrid not configured, skipping email to ${to}: ${subject}`);
    return false;
  }

  try {
    await sgMail.send({
      to,
      from: { email: env.SENDGRID_FROM_EMAIL, name: BRAND.name },
      subject,
      html,
    });
    console.log(`[Email] Sent "${subject}" to ${to}`);
    return true;
  } catch (err: any) {
    console.error(`[Email] Failed to send "${subject}" to ${to}:`, err?.response?.body || err.message);
    return false;
  }
}

// ── Email templates ──────────────────────────────────────────

export async function sendWelcomeEmail(to: string, username: string, referralCode: string): Promise<boolean> {
  const html = wrapHtml(`
    <h1>Welcome to Gammbler, ${username} &#127942;</h1>
    <p>You just took the first step toward knowing exactly how good you are at betting. No more guessing, no more lying to your friends.</p>
    <div class="card">
      <h2>What happens next:</h2>
      <p><strong>1. Add your first bet</strong> &mdash; Manual entry, CSV upload, or screenshot a bet slip</p>
      <p><strong>2. Get your Gammbler Score</strong> &mdash; A 0-100 rating across every sport</p>
      <p><strong>3. Compete</strong> &mdash; See where you rank nationally and against friends</p>
    </div>
    <p style="text-align:center">
      <a href="${BRAND.url}/dashboard/add-bet" class="btn">Add Your First Bet &rarr;</a>
    </p>
    <div class="card">
      <p class="muted" style="margin:0">Your referral code: <span class="highlight">${referralCode}</span></p>
      <p class="muted" style="margin:4px 0 0">Share it with friends &mdash; you both get 3 extra days of Pro.</p>
    </div>
  `, `Welcome to Gammbler! Your betting identity starts now.`);

  return send(to, `Welcome to Gammbler, ${username}!`, html);
}

export async function sendTrialEndingEmail(to: string, username: string, daysLeft: number): Promise<boolean> {
  const html = wrapHtml(`
    <h1>Your Pro trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}</h1>
    <p>Hey ${username}, your free Pro access is almost up. Here's what you'll lose if you don't upgrade:</p>
    <div class="card">
      <p>&#10060; Sport-specific scores (NFL, NBA, MLB, etc.)</p>
      <p>&#10060; Full analytics &amp; ROI breakdown</p>
      <p>&#10060; Friend leaderboards (per-sport)</p>
      <p>&#10060; Personalized AI insights &amp; weekly reports</p>
      <p>&#10060; Unlimited shareable score cards</p>
      <p style="margin:0">&#10060; CSV bet import</p>
    </div>
    <p>Keep everything for <span class="highlight">$8.99/month</span>. Cancel anytime.</p>
    <p style="text-align:center">
      <a href="${BRAND.url}/dashboard?upgrade=true" class="btn">Upgrade to Pro &rarr;</a>
    </p>
    <p class="muted">You'll keep your free tier features either way &mdash; your overall score, national leaderboard access, and badges aren't going anywhere.</p>
  `, `Your Gammbler Pro trial ends in ${daysLeft} days.`);

  return send(to, `Your Pro trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`, html);
}

export async function sendTrialEndedEmail(to: string, username: string): Promise<boolean> {
  const html = wrapHtml(`
    <h1>Your Pro trial has ended</h1>
    <p>Hey ${username}, your free Pro access has expired. You're now on the Free plan.</p>
    <p>You still have access to your overall Gammbler Score, national leaderboards, badges, and basic bet tracking.</p>
    <p>Want the full picture back? Upgrade anytime.</p>
    <p style="text-align:center">
      <a href="${BRAND.url}/dashboard?upgrade=true" class="btn">Get Pro for $8.99/mo &rarr;</a>
    </p>
  `, `Your Gammbler Pro trial has ended.`);

  return send(to, 'Your Pro trial has ended', html);
}

export async function sendSubscriptionConfirmedEmail(to: string, username: string): Promise<boolean> {
  const html = wrapHtml(`
    <h1>You're Pro now &#128081;</h1>
    <p>${username}, welcome to Gammbler Pro. You now have full access to everything.</p>
    <div class="card">
      <p>&#9989; All 10 sport-specific scores</p>
      <p>&#9989; Full analytics &amp; ROI breakdown</p>
      <p>&#9989; Friend &amp; national leaderboards</p>
      <p>&#9989; Personalized AI insights</p>
      <p>&#9989; Weekly performance reports</p>
      <p>&#9989; Unlimited shareable score cards (no watermark)</p>
      <p style="margin:0">&#9989; CSV bet import</p>
    </div>
    <p style="text-align:center">
      <a href="${BRAND.url}/dashboard" class="btn">Go to Dashboard &rarr;</a>
    </p>
    <p class="muted">Manage your subscription anytime from Settings.</p>
  `, `You're now a Gammbler Pro member!`);

  return send(to, `Welcome to Gammbler Pro!`, html);
}

export async function sendPaymentFailedEmail(to: string, username: string): Promise<boolean> {
  const html = wrapHtml(`
    <h1>Payment failed</h1>
    <p>Hey ${username}, we couldn't process your latest payment for Gammbler Pro.</p>
    <p>Please update your payment method to keep your Pro access. If the issue isn't resolved within 7 days, your account will be downgraded to Free.</p>
    <p style="text-align:center">
      <a href="${BRAND.url}/settings" class="btn">Update Payment Method &rarr;</a>
    </p>
  `, `Your Gammbler payment failed — please update your payment method.`);

  return send(to, 'Action needed: Payment failed', html);
}

export async function sendSubscriptionCancelledEmail(to: string, username: string): Promise<boolean> {
  const html = wrapHtml(`
    <h1>Your Pro subscription has been cancelled</h1>
    <p>Hey ${username}, your Gammbler Pro subscription has been cancelled. You'll continue to have Pro access until the end of your current billing period.</p>
    <p>After that, you'll be on the Free plan with access to your overall score, national leaderboards, and badges.</p>
    <p>Changed your mind? You can resubscribe anytime.</p>
    <p style="text-align:center">
      <a href="${BRAND.url}/dashboard?upgrade=true" class="btn">Resubscribe to Pro &rarr;</a>
    </p>
  `, `Your Gammbler Pro subscription has been cancelled.`);

  return send(to, 'Pro subscription cancelled', html);
}

export async function sendBadgeEarnedEmail(
  to: string, username: string, badgeName: string, badgeDescription: string
): Promise<boolean> {
  const html = wrapHtml(`
    <h1>New badge unlocked! &#127941;</h1>
    <p>${username}, you just earned a new achievement:</p>
    <div class="card" style="text-align:center">
      <div class="badge-icon">&#127942;</div>
      <h2>${badgeName}</h2>
      <p class="muted" style="margin:0">${badgeDescription}</p>
    </div>
    <p style="text-align:center">
      <a href="${BRAND.url}/dashboard/achievements" class="btn">View All Badges &rarr;</a>
    </p>
  `, `You earned the "${badgeName}" badge on Gammbler!`);

  return send(to, `Badge unlocked: ${badgeName}`, html);
}

export async function sendLeaderboardPassedEmail(
  to: string, username: string, passerUsername: string, sport: string, newRank: number
): Promise<boolean> {
  const sportDisplay = sport === 'overall' ? 'Overall' : sport.toUpperCase();
  const html = wrapHtml(`
    <h1>You've been passed on the leaderboard</h1>
    <p>${username}, <span class="highlight">@${passerUsername}</span> just passed you on the <strong>${sportDisplay}</strong> national leaderboard.</p>
    <p>You're now ranked <strong>#${newRank}</strong>.</p>
    <p>Time to add some more bets and climb back up.</p>
    <p style="text-align:center">
      <a href="${BRAND.url}/dashboard/leaderboards" class="btn">View Leaderboards &rarr;</a>
    </p>
  `, `${passerUsername} just passed you on the ${sportDisplay} leaderboard.`);

  return send(to, `${passerUsername} passed you on the ${sportDisplay} leaderboard`, html);
}

export async function sendNewFollowerEmail(
  to: string, username: string, followerUsername: string
): Promise<boolean> {
  const html = wrapHtml(`
    <h1>You have a new follower</h1>
    <p><span class="highlight">@${followerUsername}</span> is now following you on Gammbler.</p>
    <p style="text-align:center">
      <a href="${BRAND.url}/profile/${followerUsername}" class="btn">View Their Profile &rarr;</a>
    </p>
  `, `${followerUsername} is now following you on Gammbler.`);

  return send(to, `${followerUsername} is now following you`, html);
}

export async function sendBetSettledEmail(
  to: string, username: string, selection: string, result: string, profitLoss: string
): Promise<boolean> {
  const isWin = result === 'win';
  const emoji = isWin ? '&#128176;' : result === 'push' ? '&#129309;' : '&#128308;';
  const resultText = result.charAt(0).toUpperCase() + result.slice(1);

  const html = wrapHtml(`
    <h1>Bet settled: ${resultText} ${emoji}</h1>
    <div class="card">
      <p><strong>Selection:</strong> ${selection}</p>
      <p><strong>Result:</strong> <span class="highlight">${resultText}</span></p>
      <p style="margin:0"><strong>P/L:</strong> <span style="color:${isWin ? BRAND.color : '#ef4444'}">${profitLoss}</span></p>
    </div>
    <p>Your Gammbler Score has been updated.</p>
    <p style="text-align:center">
      <a href="${BRAND.url}/dashboard" class="btn">View Dashboard &rarr;</a>
    </p>
  `, `Your bet on "${selection}" was settled: ${resultText}.`);

  return send(to, `Bet settled: ${selection} — ${resultText}`, html);
}

export async function sendScoreChangeEmail(
  to: string, username: string, sport: string, oldScore: string, newScore: string
): Promise<boolean> {
  const sportDisplay = sport === 'overall' ? 'Overall' : sport.toUpperCase();
  const went = parseFloat(newScore) > parseFloat(oldScore) ? 'up' : 'down';
  const emoji = went === 'up' ? '&#128200;' : '&#128201;';
  const color = went === 'up' ? BRAND.color : '#ef4444';

  const html = wrapHtml(`
    <h1>${sportDisplay} Score Update ${emoji}</h1>
    <div class="card" style="text-align:center">
      <p class="muted">Your ${sportDisplay} Gammbler Score</p>
      <p style="font-size:16px;color:${BRAND.textMuted};margin:0"><s>${oldScore}</s></p>
      <div class="score" style="color:${color}">${newScore}</div>
    </div>
    <p style="text-align:center">
      <a href="${BRAND.url}/dashboard" class="btn">View Full Breakdown &rarr;</a>
    </p>
  `, `Your ${sportDisplay} Gammbler Score went ${went}: ${oldScore} → ${newScore}.`);

  return send(to, `Score ${went}: ${sportDisplay} ${oldScore} → ${newScore}`, html);
}

export async function sendWeeklyReportEmail(
  to: string,
  username: string,
  data: {
    overallScore: string;
    scoreChange: string;
    betsThisWeek: number;
    record: string;
    roi: string;
    bestSport: string;
    bestSportScore: string;
    nationalRank: number;
  }
): Promise<boolean> {
  const changeNum = parseFloat(data.scoreChange);
  const changeColor = changeNum >= 0 ? BRAND.color : '#ef4444';
  const changePrefix = changeNum >= 0 ? '+' : '';

  const html = wrapHtml(`
    <h1>Your Weekly Report &#128202;</h1>
    <p>Here's how you did this week, ${username}:</p>
    <div class="card" style="text-align:center">
      <p class="muted" style="margin:0 0 4px">Overall Gammbler Score</p>
      <div class="score">${data.overallScore}</div>
      <p style="color:${changeColor};font-weight:700;margin:4px 0 0">${changePrefix}${data.scoreChange} this week</p>
    </div>
    <div class="card">
      <div class="stat-row">
        <span class="stat-label">Bets placed</span>
        <span class="stat-value">${data.betsThisWeek}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Record</span>
        <span class="stat-value">${data.record}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">ROI</span>
        <span class="stat-value" style="color:${parseFloat(data.roi) >= 0 ? BRAND.color : '#ef4444'}">${data.roi}%</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Best sport</span>
        <span class="stat-value">${data.bestSport} (${data.bestSportScore})</span>
      </div>
      <div class="stat-row" style="border:none">
        <span class="stat-label">National rank</span>
        <span class="stat-value">#${data.nationalRank}</span>
      </div>
    </div>
    <p style="text-align:center">
      <a href="${BRAND.url}/dashboard/insights" class="btn">View Full Insights &rarr;</a>
    </p>
    <p class="muted" style="text-align:center">Keep betting, keep climbing. See you next week.</p>
  `, `Your Gammbler weekly report: Score ${data.overallScore}, ${data.betsThisWeek} bets, ${data.record} record.`);

  return send(to, `Weekly Report: Score ${data.overallScore} (${changePrefix}${data.scoreChange})`, html);
}
