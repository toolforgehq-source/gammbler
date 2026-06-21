import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicFetch, StatsResponse } from '@/lib/public-api';
import { articleSchema, faqSchema, breadcrumbSchema } from '@/lib/structured-data';

type Params = Promise<{ slug: string }>;

interface KnowledgePage {
  slug: string;
  title: string;
  metaDescription: string;
  heading: string;
  subheading: string;
  sections: Array<{ heading: string; content: (stats: StatsResponse | null) => string }>;
  faqs: Array<{ question: string; answer: (stats: StatsResponse | null) => string }>;
  relatedLinks: Array<{ href: string; title: string; description: string }>;
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'N/A';
  return `${n.toFixed(1)}%`;
}

const KNOWLEDGE_PAGES: Record<string, KnowledgePage> = {
  'what-is-gammbler': {
    slug: 'what-is-gammbler',
    title: 'What is Gammbler? — Sports Betting Analytics Platform',
    metaDescription: 'Gammbler is a sports betting analytics platform where every bettor gets a score. Track your record, compete on national leaderboards, and prove your betting skill with real data.',
    heading: 'What is Gammbler?',
    subheading: 'Gammbler is a sports betting analytics platform where every bettor gets a score based on real, tracked betting records.',
    sections: [
      {
        heading: 'Overview',
        content: (stats) => `Gammbler is a sports betting performance analytics platform. It tracks real betting records and assigns every bettor a score from 0 to 100 — the Gammbler Score. Unlike self-reported records, Gammbler verifies bets through sportsbook connections and manual entry with odds verification.${stats ? ` The platform currently tracks ${stats.total_bets?.toLocaleString() ?? 'thousands of'} bets across ${stats.total_users?.toLocaleString() ?? 'hundreds of'} bettors.` : ''}`,
      },
      {
        heading: 'How It Works',
        content: () => `Bettors log their picks — either manually or by connecting a sportsbook. Once a bet settles, Gammbler recalculates the bettor's score using a multi-factor algorithm that considers win rate, ROI, volume, bet type diversity, and closing line value. After 10 settled bets, the bettor's Gammbler Score unlocks and they appear on the national leaderboard.`,
      },
      {
        heading: 'National Leaderboards',
        content: () => `Gammbler maintains national leaderboards across 8 sports: NFL, NBA, MLB, NHL, CFB, CBB, Soccer, and an Overall leaderboard. Bettors are ranked by their Gammbler Score and placed into tiers: Rookie (0-39), Contender (40-59), Veteran (60-74), Elite (75-89), and Legend (90-100).`,
      },
      {
        heading: 'Creator Platform',
        content: () => `Gammbler also operates a creator platform where verified bettors can share picks, build an audience, and monetize their expertise. Every creator's performance is transparent — subscribers can see the creator's real Gammbler Score, win rate, ROI, and full betting record before subscribing.`,
      },
      {
        heading: 'Gammbler Is NOT a Sportsbook',
        content: () => `Gammbler does not accept wagers and is not a sportsbook. It is a skill-based analytics platform that measures and ranks sports bettors based on their real performance data. Gammbler promotes responsible gambling and provides tools for bettors to understand their actual performance versus their perceived performance.`,
      },
    ],
    faqs: [
      { question: 'Is Gammbler a sportsbook?', answer: () => 'No. Gammbler does not accept wagers. It is an analytics platform that tracks and scores sports bettors based on their real betting records.' },
      { question: 'Is Gammbler free?', answer: () => 'Gammbler offers a free tier that includes bet tracking, overall score, and friends leaderboard. Pro features include sport-specific scores, national leaderboards, and advanced analytics.' },
      { question: 'How do I get a Gammbler Score?', answer: () => 'Sign up, log at least 10 bets (manually or by connecting a sportsbook), and wait for them to settle. Your score unlocks automatically once 10 bets have settled.' },
    ],
    relatedLinks: [
      { href: '/learn/how-gammbler-score-calculated', title: 'How is Gammbler Score Calculated?', description: 'Learn the scoring algorithm' },
      { href: '/stats', title: 'Platform Statistics', description: 'See real performance data' },
      { href: '/leaderboard', title: 'National Leaderboard', description: 'See the top-ranked bettors' },
    ],
  },

  'how-gammbler-score-calculated': {
    slug: 'how-gammbler-score-calculated',
    title: 'How is Gammbler Score Calculated? — Scoring Algorithm Explained',
    metaDescription: 'The Gammbler Score is a 0-100 rating calculated from win rate, ROI, bet volume, diversity, and closing line value. Learn exactly how the scoring algorithm works.',
    heading: 'How is Gammbler Score Calculated?',
    subheading: 'The Gammbler Score is a multi-factor rating from 0 to 100 that measures overall betting skill based on real, tracked records.',
    sections: [
      {
        heading: 'The Five Factors',
        content: () => `The Gammbler Score combines five factors into a single 0-100 rating:\n\n1. **Win Rate** — The percentage of bets won. Higher win rates contribute to higher scores.\n2. **ROI (Return on Investment)** — Net profit divided by total amount wagered. Measures profitability independent of volume.\n3. **Volume** — Total number of settled bets. More bets provide a more reliable sample size.\n4. **Diversity** — Variety of bet types used (moneyline, spread, over/under, props, parlays). Diversified bettors demonstrate broader skill.\n5. **CLV (Closing Line Value)** — Whether bets are placed at odds better than the closing line. This is considered the strongest predictor of long-term betting skill.`,
      },
      {
        heading: 'Score Tiers',
        content: () => `Bettors are grouped into five tiers based on their Gammbler Score:\n\n- **Legend** (90-100): The elite of the elite. Consistently profitable with high CLV.\n- **Elite** (75-89): Strong, skilled bettors with demonstrated profitability.\n- **Veteran** (60-74): Experienced bettors with solid records.\n- **Contender** (40-59): Average bettors — close to breakeven.\n- **Rookie** (0-39): Below-average performance. Room for improvement.`,
      },
      {
        heading: 'Sport-Specific Scores',
        content: () => `In addition to the Overall score, Gammbler calculates separate scores for each sport (NFL, NBA, MLB, NHL, CFB, CBB, Soccer). This means a bettor could be an Elite NFL bettor but a Rookie NBA bettor — sport-specific scores reveal where your actual strengths are.`,
      },
      {
        heading: 'Score Unlocking',
        content: () => `Your Gammbler Score is locked until you have at least 10 settled bets. This prevents small sample sizes from producing misleading scores. Once unlocked, your score recalculates with every settled bet.`,
      },
    ],
    faqs: [
      { question: 'How many bets do I need for a Gammbler Score?', answer: () => 'You need at least 10 settled bets to unlock your score.' },
      { question: 'How often does the score update?', answer: () => 'Your score recalculates automatically every time a bet settles.' },
      { question: 'Can I have different scores for different sports?', answer: () => 'Yes. Gammbler calculates separate scores for each sport as well as an overall score.' },
      { question: 'What is CLV and why does it matter?', answer: () => 'CLV (Closing Line Value) measures whether you consistently get odds better than the closing line. It is the strongest known predictor of long-term betting profitability.' },
    ],
    relatedLinks: [
      { href: '/learn/good-betting-win-rate', title: 'What is a Good Betting Win Rate?', description: 'Real win rate data from tracked bettors' },
      { href: '/learn/good-betting-roi', title: 'What is a Good Betting ROI?', description: 'ROI benchmarks from real data' },
      { href: '/leaderboard', title: 'See the Leaderboard', description: 'View ranked bettors by Gammbler Score' },
    ],
  },

  'good-betting-win-rate': {
    slug: 'good-betting-win-rate',
    title: 'What is a Good Betting Win Rate? — Real Data from Tracked Bettors',
    metaDescription: 'What win rate do you need to be profitable in sports betting? Real data from tracked bettors shows the average win rate and what separates winners from losers.',
    heading: 'What is a Good Betting Win Rate?',
    subheading: 'Based on real data from tracked bettors on Gammbler, here is what a good betting win rate actually looks like.',
    sections: [
      {
        heading: 'The Data',
        content: (stats) => `Based on real betting data tracked on Gammbler${stats ? ` across ${stats.total_bets?.toLocaleString() ?? 'thousands of'} bets from ${stats.scored_users?.toLocaleString() ?? 'hundreds of'} scored bettors` : ''}, the average bettor win rate is ${stats?.avg_win_rate ? `${(stats.avg_win_rate * 100).toFixed(1)}%` : 'approximately 47-49%'}.`,
      },
      {
        heading: 'Breakeven Win Rate',
        content: () => `For standard -110 odds (the most common line in point spread and over/under betting), the breakeven win rate is 52.4%. This means you need to win more than 52.4% of your bets at -110 odds just to break even after accounting for the sportsbook's vig (juice). Most bettors fall below this threshold.`,
      },
      {
        heading: 'Win Rate by Bet Type',
        content: () => `Win rate benchmarks vary significantly by bet type:\n\n- **Moneyline** (favorites): Higher win rate (60-70%+) but lower profit per win\n- **Moneyline** (underdogs): Lower win rate (25-40%) but higher profit per win\n- **Point Spread**: ~47-53% for most bettors. Need 52.4%+ to be profitable\n- **Over/Under**: Similar to spreads — ~47-53% for most bettors\n- **Parlays**: Much lower win rate (10-30%) due to compounding odds\n- **Props**: Highly variable — ranges from 40-60% depending on market efficiency`,
      },
      {
        heading: 'Win Rate by Sport',
        content: (stats) => {
          if (!stats?.sport_breakdown?.length) return 'Win rates also vary by sport. NFL, with its weekly schedule and extensive analysis, tends to produce the tightest markets. MLB and NBA, with daily games and larger sample sizes, can offer more opportunities.';
          const lines = stats.sport_breakdown
            .filter(s => s.avg_win_rate !== null)
            .map(s => `- **${s.sport.toUpperCase()}**: Average win rate of ${(s.avg_win_rate! * 100).toFixed(1)}% across ${s.total_scored} scored bettors`);
          return `Based on Gammbler data:\n\n${lines.join('\n')}`;
        },
      },
      {
        heading: 'What Separates Good from Great',
        content: () => `A "good" win rate depends on what odds you are betting. At -110, anything above 53% is solid. At +150, 40% could be highly profitable. The real measure is not win rate alone — it is win rate relative to the odds you are getting. This is why Gammbler's scoring algorithm considers both win rate AND ROI together, rather than ranking bettors by win rate alone.`,
      },
    ],
    faqs: [
      { question: 'What win rate do I need to be profitable?', answer: () => 'At standard -110 odds, you need to win at least 52.4% of your bets to break even. Profitable bettors typically win 53-58% at -110.' },
      { question: 'Is a 55% win rate good?', answer: () => 'Yes. At -110 odds, a 55% win rate produces a roughly 4.5% ROI, which would place you among the top bettors on most platforms.' },
      { question: 'Why does my win rate not match my profitability?', answer: () => 'Win rate alone does not determine profitability. A bettor winning 60% of -300 favorites may be less profitable than a bettor winning 40% of +200 underdogs. ROI is the better profitability measure.' },
    ],
    relatedLinks: [
      { href: '/stats', title: 'Betting Statistics', description: 'See real win rates across all sports' },
      { href: '/learn/good-betting-roi', title: 'What is a Good ROI?', description: 'ROI benchmarks from real data' },
      { href: '/learn/profitable-bettors-percentage', title: 'What % of Bettors Are Profitable?', description: 'Data on profitability rates' },
    ],
  },

  'good-betting-roi': {
    slug: 'good-betting-roi',
    title: 'What is a Good Betting ROI? — Real Profitability Data',
    metaDescription: 'What ROI can you expect from sports betting? Real data from tracked bettors shows average ROI, profitability rates, and what separates profitable bettors from the rest.',
    heading: 'What is a Good Betting ROI?',
    subheading: 'ROI (Return on Investment) is the most important measure of betting profitability. Here is what the data says.',
    sections: [
      {
        heading: 'Average ROI',
        content: (stats) => `Based on real data from Gammbler${stats ? ` tracking ${stats.total_bets?.toLocaleString() ?? 'thousands of'} bets` : ''}, the average bettor ROI is ${stats?.avg_roi !== null && stats?.avg_roi !== undefined ? `${stats.avg_roi > 0 ? '+' : ''}${stats.avg_roi.toFixed(1)}%` : 'slightly negative, typically between -3% and -7%'}. This aligns with the well-known fact that most bettors lose money due to the sportsbook's built-in edge (the vig/juice).`,
      },
      {
        heading: 'What is Betting ROI?',
        content: () => `ROI measures your net profit relative to the total amount you wagered. The formula is simple:\n\n**ROI = (Net Profit / Total Amount Wagered) x 100**\n\nFor example, if you wagered $10,000 total and ended with $10,500, your ROI is +5%. If you ended with $9,700, your ROI is -3%.`,
      },
      {
        heading: 'ROI Benchmarks',
        content: () => `- **Below -5%**: Poor. Losing money consistently. Most casual bettors fall here.\n- **-5% to 0%**: Below average. Losing less than most, but still unprofitable.\n- **0% to +3%**: Breakeven to slightly profitable. Better than most bettors.\n- **+3% to +7%**: Good. Consistently profitable. Would rank well on Gammbler.\n- **+7% to +15%**: Excellent. Among the best tracked bettors.\n- **+15%+**: Elite. Rare — only a small percentage sustain this level.`,
      },
      {
        heading: 'ROI by Sport',
        content: (stats) => {
          if (!stats?.sport_breakdown?.length) return 'ROI varies significantly by sport. Sports with more efficient markets (NFL) tend to have lower average ROIs, while less efficient markets may offer higher potential returns.';
          const lines = stats.sport_breakdown
            .filter(s => s.avg_roi !== null)
            .map(s => `- **${s.sport.toUpperCase()}**: Average ROI of ${s.avg_roi! > 0 ? '+' : ''}${s.avg_roi!.toFixed(1)}%`);
          return `Based on Gammbler data:\n\n${lines.join('\n')}`;
        },
      },
      {
        heading: 'Why ROI Matters More Than Win Rate',
        content: () => `A bettor with a 45% win rate betting underdogs at +200 can be far more profitable than a bettor with a 58% win rate betting heavy favorites at -300. Win rate tells you how often you win. ROI tells you whether you actually make money. This is why serious bettors and the Gammbler scoring algorithm prioritize ROI over raw win rate.`,
      },
    ],
    faqs: [
      { question: 'What ROI do professional bettors achieve?', answer: () => 'Professional sports bettors typically achieve 3-10% ROI over large sample sizes (1,000+ bets). Very few sustain above 10% long-term.' },
      { question: 'Is a negative ROI normal?', answer: () => 'Yes. The majority of sports bettors have a negative ROI. The sportsbook\'s vig guarantees that the average bettor will lose money over time.' },
      { question: 'How many bets do I need for a reliable ROI?', answer: () => 'At least 200-500 bets at similar odds to have a statistically meaningful ROI. Fewer bets means your ROI is dominated by variance, not skill.' },
    ],
    relatedLinks: [
      { href: '/stats', title: 'Betting Statistics', description: 'See real ROI data across all sports' },
      { href: '/learn/good-betting-win-rate', title: 'What is a Good Win Rate?', description: 'Win rate benchmarks from real data' },
      { href: '/learn/profitable-bettors-percentage', title: 'What % Are Profitable?', description: 'Real profitability data' },
    ],
  },

  'sports-betting-leaderboards': {
    slug: 'sports-betting-leaderboards',
    title: 'How Do Sports Betting Leaderboards Work? — Ranking Methodology',
    metaDescription: 'How sports betting leaderboards rank bettors using real performance data. Learn about Gammbler\'s ranking methodology, score tiers, and how to climb the leaderboard.',
    heading: 'How Do Sports Betting Leaderboards Work?',
    subheading: 'Sports betting leaderboards rank bettors by verified performance data — not self-reported records.',
    sections: [
      {
        heading: 'The Problem with Self-Reported Records',
        content: () => `Most sports betting "leaderboards" rely on self-reported records. Bettors claim a record, and there is no verification. This creates obvious problems: selective reporting (only sharing wins), inflated records, and no accountability. Gammbler solves this by tracking every bet and calculating scores from verified data.`,
      },
      {
        heading: 'How Gammbler Rankings Work',
        content: (stats) => `Gammbler maintains national leaderboards across 8 sports (NFL, NBA, MLB, NHL, CFB, CBB, Soccer, and Overall).${stats ? ` Currently, ${stats.scored_users?.toLocaleString() ?? 'hundreds of'} bettors are scored and ranked.` : ''}\n\nBettors are ranked by their Gammbler Score, which combines win rate, ROI, volume, diversity, and closing line value into a single 0-100 rating. Bettors must have at least 10 settled bets to appear on the leaderboard.`,
      },
      {
        heading: 'Tiers',
        content: () => `The leaderboard groups bettors into five tiers:\n\n- **Legend** (90-100)\n- **Elite** (75-89)\n- **Veteran** (60-74)\n- **Contender** (40-59)\n- **Rookie** (0-39)\n\nThese tiers provide context for what a score means. A score of 72 is "Veteran" — above average, demonstrating consistent skill.`,
      },
      {
        heading: 'Friends vs. National',
        content: () => `Gammbler offers two leaderboard views: Friends (how you compare to people you follow) and National (how you compare to everyone). The Friends leaderboard is available with a free account. The National leaderboard requires a Pro subscription.`,
      },
    ],
    faqs: [
      { question: 'Can I see the leaderboard without signing up?', answer: () => 'Yes. The public leaderboard at gammbler.com/leaderboard shows the top-ranked bettors with their scores, win rates, and ROI.' },
      { question: 'How do I get on the leaderboard?', answer: () => 'Sign up, log at least 10 bets, and wait for them to settle. Your score unlocks automatically and you appear on the leaderboard.' },
      { question: 'Can I be ranked in multiple sports?', answer: () => 'Yes. You get a separate score and ranking for each sport you bet on, as well as an overall ranking.' },
    ],
    relatedLinks: [
      { href: '/leaderboard', title: 'View the Leaderboard', description: 'See the top-ranked bettors' },
      { href: '/learn/how-gammbler-score-calculated', title: 'How Scores Work', description: 'Learn the scoring algorithm' },
      { href: '/stats', title: 'Platform Statistics', description: 'See aggregate performance data' },
    ],
  },

  'sports-betting-creators': {
    slug: 'sports-betting-creators',
    title: 'How Do Sports Betting Creators Make Money? — Creator Economy',
    metaDescription: 'How sports betting creators monetize their expertise on Gammbler. Learn about the creator model, subscription pricing, and what makes successful sports betting content creators.',
    heading: 'How Do Sports Betting Creators Make Money?',
    subheading: 'Sports betting creators monetize their expertise through subscriptions, with fully transparent and verified performance records.',
    sections: [
      {
        heading: 'The Creator Model',
        content: () => `On Gammbler, creators are bettors who share their picks and analysis with subscribers. Unlike traditional tipster services where you have no way to verify a creator's actual record, Gammbler verifies every bet. Subscribers can see the creator's real Gammbler Score, full betting record, win rate, and ROI before subscribing.`,
      },
      {
        heading: 'Revenue',
        content: () => `Creators set a monthly subscription price. Subscribers pay to access the creator's picks, analysis, and betting content. The creator receives a share of each subscription. Because performance is transparent, creators who consistently produce positive ROI can build large, loyal subscriber bases.`,
      },
      {
        heading: 'What Makes a Successful Creator',
        content: () => `The most successful creators on Gammbler combine:\n\n1. **Verified performance** — A high Gammbler Score that proves their expertise\n2. **Consistent posting** — Regular picks and analysis that give subscribers value\n3. **Transparency** — Full record visibility, including losses\n4. **Specialization** — Deep expertise in one or two sports rather than trying to cover everything\n5. **Community** — Engaging with subscribers, explaining reasoning, teaching methodology`,
      },
      {
        heading: 'Accountability',
        content: () => `The key difference between Gammbler creators and traditional sports betting tipsters is accountability. Every pick is tracked. Every result is recorded. If a creator has a losing month, it shows in their record and score. This accountability mechanism protects subscribers and rewards genuinely skilled bettors.`,
      },
    ],
    faqs: [
      { question: 'How do I become a creator on Gammbler?', answer: () => 'Sign up, build your betting record, and apply for creator status. You need a Gammbler Score and at least 10 settled bets to apply.' },
      { question: 'How much do creators charge?', answer: () => 'Creators set their own subscription price. Prices typically range from $4.99 to $49.99 per month depending on the creator\'s track record and content volume.' },
      { question: 'Can I see a creator\'s record before subscribing?', answer: () => 'Yes. Every creator\'s Gammbler Score, record, win rate, and ROI are publicly visible. You can verify their performance before paying anything.' },
    ],
    relatedLinks: [
      { href: '/creators', title: 'Browse Creators', description: 'See all verified creators' },
      { href: '/learn/what-is-gammbler', title: 'What is Gammbler?', description: 'Platform overview' },
      { href: '/leaderboard', title: 'Leaderboard', description: 'Top-ranked bettors' },
    ],
  },

  'track-betting-record': {
    slug: 'track-betting-record',
    title: 'How Do I Track My Betting Record? — Bet Tracking Methods',
    metaDescription: 'The best ways to track your sports betting record: spreadsheets, apps, and platforms like Gammbler that automatically calculate your score, ROI, and win rate.',
    heading: 'How Do I Track My Betting Record?',
    subheading: 'Tracking your bets is the first step to understanding whether you are actually profitable. Here are the main methods.',
    sections: [
      {
        heading: 'Why Track?',
        content: () => `Most bettors think they are better than they are. Selective memory causes people to remember big wins and forget quiet losses. Without tracking, you genuinely do not know whether you are profitable. Tracking removes the guesswork and gives you an honest picture of your performance.`,
      },
      {
        heading: 'Method 1: Spreadsheet',
        content: () => `The simplest method. Create a spreadsheet with columns for: date, sport, bet type, selection, odds, stake, result, and profit/loss. This works but requires discipline — you must manually enter every bet and calculate your own stats. Most people start with a spreadsheet and give up within a month.`,
      },
      {
        heading: 'Method 2: Sportsbook History',
        content: () => `Most sportsbooks provide bet history. The problem: if you use multiple sportsbooks (which most serious bettors do), your data is fragmented across platforms. You cannot get a unified view of your performance without manually combining records.`,
      },
      {
        heading: 'Method 3: Dedicated Tracking Platform',
        content: () => `Platforms like Gammbler solve both problems. You can either manually log bets (with odds verification) or connect your sportsbook for automatic import. The platform calculates your win rate, ROI, score, and rankings automatically. It also provides features a spreadsheet never will: national leaderboards, sport-specific breakdowns, closing line value analysis, and peer comparison.`,
      },
      {
        heading: 'What to Track',
        content: () => `At minimum, track these for every bet:\n\n- **Sport and league**\n- **Bet type** (moneyline, spread, over/under, prop, parlay)\n- **Selection** (what you bet on)\n- **Odds** (at time of bet placement)\n- **Stake** (how much you wagered)\n- **Result** (win, loss, push)\n- **Profit/loss** (net amount won or lost)\n\nWith this data, you can calculate win rate, ROI, and identify which sports, bet types, and strategies work best for you.`,
      },
    ],
    faqs: [
      { question: 'What is the best way to track bets?', answer: () => 'A dedicated platform like Gammbler that automatically calculates your score, win rate, ROI, and rankings. Manual spreadsheets work but most people abandon them.' },
      { question: 'Can I import bets from my sportsbook?', answer: () => 'Yes. Gammbler supports sportsbook connections that automatically import and verify your bets.' },
      { question: 'How many bets should I track before drawing conclusions?', answer: () => 'At least 100-200 bets for reliable win rate data, and 500+ for statistically significant ROI. Gammbler unlocks your score after 10 bets but accuracy improves with more data.' },
    ],
    relatedLinks: [
      { href: '/learn/what-is-gammbler', title: 'What is Gammbler?', description: 'Learn about the platform' },
      { href: '/learn/good-betting-win-rate', title: 'What is a Good Win Rate?', description: 'Win rate benchmarks' },
      { href: '/stats', title: 'Betting Statistics', description: 'See aggregate performance data' },
    ],
  },

  'profitable-bettors-percentage': {
    slug: 'profitable-bettors-percentage',
    title: 'What Percentage of Bettors Are Profitable? — Real Data',
    metaDescription: 'What percentage of sports bettors actually make money? Real data from tracked bettors shows the profitability rate, and it is lower than most people think.',
    heading: 'What Percentage of Bettors Are Profitable?',
    subheading: 'Based on real data from tracked bettors, here is how many sports bettors are actually profitable.',
    sections: [
      {
        heading: 'The Data',
        content: (stats) => {
          if (stats?.profitable_percentage !== null && stats?.profitable_percentage !== undefined) {
            return `Based on real data from ${stats.scored_users?.toLocaleString() ?? ''} scored bettors on Gammbler (each with 10+ settled bets), ${fmtPct(stats.profitable_percentage)} of tracked bettors have a positive ROI. That means ${fmtPct(100 - stats.profitable_percentage)} are either breaking even or losing money.`;
          }
          return `Industry estimates suggest that only 3-10% of sports bettors are profitable long-term. Gammbler's tracked data provides a more precise answer as the platform grows.`;
        },
      },
      {
        heading: 'Why Most Bettors Lose',
        content: () => `There are structural reasons why most bettors lose:\n\n1. **The vig (juice)**: Sportsbooks charge a commission on every bet. At standard -110 odds, the sportsbook takes ~4.5% off the top. You need to win 52.4% just to break even.\n2. **Behavioral biases**: Bettors tend to bet favorites and overs too heavily, chase losses, and increase stakes after wins. These behaviors erode bankrolls.\n3. **Selective memory**: Without tracking, bettors overestimate their win rate by 10-15 percentage points on average.\n4. **Market efficiency**: Sportsbook lines are set by sophisticated models and adjusted by sharp action. Consistently finding value is difficult.`,
      },
      {
        heading: 'What Profitable Bettors Do Differently',
        content: () => `The bettors who maintain positive ROI on Gammbler tend to share common traits:\n\n- **Specialization**: They focus on 1-2 sports rather than betting everything\n- **Discipline**: They track every bet and stick to a staking plan\n- **CLV focus**: They consistently get odds better than the closing line\n- **Bankroll management**: They risk 1-3% of their bankroll per bet\n- **Volume control**: They are selective — quality over quantity\n- **Emotional control**: They do not chase losses or increase stakes after bad streaks`,
      },
      {
        heading: 'Profitability by Sport',
        content: (stats) => {
          if (!stats?.sport_breakdown?.length) return 'Profitability rates vary by sport. More efficient markets like NFL tend to have fewer profitable bettors, while less efficient markets may offer more opportunities.';
          const lines = stats.sport_breakdown
            .filter(s => s.avg_roi !== null)
            .map(s => `- **${s.sport.toUpperCase()}**: Average ROI of ${s.avg_roi! > 0 ? '+' : ''}${s.avg_roi!.toFixed(1)}% across ${s.total_scored} scored bettors`);
          return `Profitability data by sport from Gammbler:\n\n${lines.join('\n')}`;
        },
      },
    ],
    faqs: [
      { question: 'What percentage of sports bettors are profitable?', answer: (stats) => stats?.profitable_percentage !== null && stats?.profitable_percentage !== undefined ? `Based on Gammbler's tracked data, ${fmtPct(stats.profitable_percentage)} of scored bettors have a positive ROI.` : 'Industry estimates suggest 3-10% of bettors are profitable long-term. Gammbler provides real data as the platform grows.' },
      { question: 'Can you make a living from sports betting?', answer: () => 'It is mathematically possible but extremely difficult. A professional bettor typically achieves 3-7% ROI, meaning they need substantial bankroll and volume to generate meaningful income.' },
      { question: 'How do I know if I am a profitable bettor?', answer: () => 'Track at least 200+ bets with consistent stake sizes. If your ROI is positive over that sample, you are likely a winning bettor. Gammbler calculates this automatically.' },
    ],
    relatedLinks: [
      { href: '/stats', title: 'Betting Statistics', description: 'See real profitability data' },
      { href: '/learn/good-betting-roi', title: 'What is a Good ROI?', description: 'ROI benchmarks' },
      { href: '/learn/good-betting-win-rate', title: 'What is a Good Win Rate?', description: 'Win rate data from real bettors' },
    ],
  },
};

const VALID_SLUGS = Object.keys(KNOWLEDGE_PAGES);

export async function generateStaticParams() {
  return VALID_SLUGS.map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const page = KNOWLEDGE_PAGES[slug];
  if (!page) return { title: 'Not Found' };
  return {
    title: page.title,
    description: page.metaDescription,
    openGraph: {
      title: page.title,
      description: page.metaDescription,
      type: 'article',
    },
  };
}

function renderMarkdown(text: string) {
  // Simple markdown rendering for bold text and line breaks
  const parts = text.split('\n\n');
  return parts.map((block, i) => {
    if (block.startsWith('- ')) {
      const items = block.split('\n').filter(l => l.startsWith('- '));
      return (
        <ul key={i} className="list-disc list-inside space-y-2 text-foreground/80">
          {items.map((item, j) => (
            <li key={j} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{
              __html: item.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>')
            }} />
          ))}
        </ul>
      );
    }
    if (block.match(/^\d+\./)) {
      const items = block.split('\n').filter(l => l.match(/^\d+\./));
      return (
        <ol key={i} className="list-decimal list-inside space-y-2 text-foreground/80">
          {items.map((item, j) => (
            <li key={j} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{
              __html: item.replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>')
            }} />
          ))}
        </ol>
      );
    }
    return (
      <p key={i} className="text-sm leading-relaxed text-foreground/80" dangerouslySetInnerHTML={{
        __html: block.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>')
      }} />
    );
  });
}

export default async function LearnPage({ params }: { params: Params }) {
  const { slug } = await params;
  const page = KNOWLEDGE_PAGES[slug];
  if (!page) notFound();

  const stats = await publicFetch<StatsResponse>('/stats');

  const jsonLd = [
    articleSchema({
      title: page.title,
      description: page.metaDescription,
      slug: page.slug,
    }),
    faqSchema(page.faqs.map(f => ({
      question: f.question,
      answer: f.answer(stats),
    }))),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Learn', url: '/learn/what-is-gammbler' },
      { name: page.heading, url: `/learn/${page.slug}` },
    ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-dark mb-6">
          <Link href="/" className="hover:text-accent">Home</Link>
          <span>/</span>
          <Link href="/learn/what-is-gammbler" className="hover:text-accent">Learn</Link>
          <span>/</span>
          <span className="text-foreground">{page.heading}</span>
        </nav>

        <header className="mb-12">
          <h1 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight text-foreground mb-4">
            {page.heading}
          </h1>
          <p className="text-lg text-muted-dark max-w-3xl">{page.subheading}</p>
        </header>

        {/* Content Sections */}
        <div className="space-y-10 mb-12">
          {page.sections.map((section, i) => (
            <section key={i}>
              <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
                {section.heading}
              </h2>
              <div className="space-y-4">
                {renderMarkdown(section.content(stats))}
              </div>
            </section>
          ))}
        </div>

        {/* FAQ Section */}
        <section className="mb-12 border-t border-accent/10 pt-8">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {page.faqs.map((faq, i) => (
              <div key={i} className="bg-card border border-accent/10 rounded-xl p-6">
                <h3 className="font-bold text-foreground mb-2">{faq.question}</h3>
                <p className="text-sm text-foreground/80 leading-relaxed">{faq.answer(stats)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="bg-card border border-accent/20 rounded-xl p-8 text-center mb-8">
          <h2 className="font-display text-xl font-bold text-foreground mb-2">Get Your Gammbler Score</h2>
          <p className="text-sm text-muted-dark mb-4">Track your bets, earn your score, and see how you compare.</p>
          <Link
            href="/signup"
            className="inline-block bg-accent hover:bg-accent-light text-background text-sm font-bold px-6 py-3 rounded-lg transition-colors"
          >
            Sign Up Free
          </Link>
        </div>

        {/* Related Links */}
        <section className="border-t border-accent/10 pt-8">
          <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
            Related
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {page.relatedLinks.map(link => (
              <Link key={link.href} href={link.href} className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
                <h3 className="font-display font-bold text-foreground mb-1">{link.title}</h3>
                <p className="text-sm text-muted-dark">{link.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* All Learn Pages */}
        <section className="mt-8 border-t border-accent/10 pt-8">
          <h3 className="font-display text-lg font-bold uppercase text-foreground mb-4">All Learn Pages</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {VALID_SLUGS.filter(s => s !== slug).map(s => (
              <Link key={s} href={`/learn/${s}`} className="text-sm text-accent hover:text-accent-light">
                {KNOWLEDGE_PAGES[s].heading}
              </Link>
            ))}
          </div>
        </section>
      </article>
    </>
  );
}
