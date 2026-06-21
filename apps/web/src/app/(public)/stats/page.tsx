import { Metadata } from 'next';
import Link from 'next/link';
import { publicFetch, StatsResponse } from '@/lib/public-api';
import { datasetSchema, breadcrumbSchema } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Sports Betting Statistics — Real Performance Data | Gammbler',
  description: 'Real sports betting statistics from tracked bettors: average win rate, ROI, score distribution, and profitability data. Based on real betting records, not surveys.',
  openGraph: {
    title: 'Sports Betting Statistics — Real Performance Data | Gammbler',
    description: 'Real sports betting statistics from tracked bettors: average win rate, ROI, score distribution, and profitability data.',
    type: 'website',
  },
};

const SPORT_LABELS: Record<string, string> = {
  nfl: 'NFL', nba: 'NBA', mlb: 'MLB', nhl: 'NHL',
  cfb: 'CFB', cbb: 'CBB', soccer: 'Soccer', prizepicks: 'PrizePicks', dfs: 'DFS',
};

function fmt(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined) return '—';
  return n.toFixed(decimals);
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${n.toFixed(1)}%`;
}

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString();
}

export default async function StatsPage() {
  const stats = await publicFetch<StatsResponse>('/stats');

  const jsonLd = [
    datasetSchema({
      name: 'Gammbler Sports Betting Performance Data',
      description: `Aggregated sports betting performance statistics from ${stats?.total_bets?.toLocaleString() ?? 'thousands of'} tracked bets. Includes win rates, ROI, score distributions, and profitability analysis.`,
      url: 'https://gammbler.com/stats',
      keywords: ['sports betting statistics', 'betting win rate', 'betting ROI', 'sports betting data', 'bettor performance'],
      totalBets: stats?.total_bets ?? undefined,
      totalUsers: stats?.total_users ?? undefined,
    }),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Statistics', url: '/stats' },
    ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="mb-12">
          <h1 className="font-display text-4xl md:text-5xl font-black uppercase tracking-tight text-foreground mb-4">
            Sports Betting Statistics
          </h1>
          <p className="text-lg text-muted-dark max-w-3xl">
            Real performance data from tracked bettors on Gammbler. Not surveys, not estimates —
            actual betting records analyzed across {fmtInt(stats?.total_bets)} bets.
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <MetricCard label="Total Bets Tracked" value={fmtInt(stats?.total_bets)} />
          <MetricCard label="Tracked Bettors" value={fmtInt(stats?.total_users)} />
          <MetricCard label="Scored Bettors" value={fmtInt(stats?.scored_users)} subtitle="10+ settled bets" />
          <MetricCard label="Avg Gammbler Score" value={fmt(stats?.avg_score)} subtitle="out of 100" />
        </div>

        {/* Performance Averages */}
        <section className="mb-12">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground mb-6">
            Average Bettor Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card border border-accent/10 rounded-xl p-6">
              <p className="text-sm text-muted-dark uppercase tracking-wider mb-2">Average Win Rate</p>
              <p className="font-number text-4xl font-bold text-foreground">{fmtPct(stats?.avg_win_rate ? stats.avg_win_rate * 100 : null)}</p>
              <p className="text-xs text-muted-dark mt-2">Across all scored bettors on the platform</p>
            </div>
            <div className="bg-card border border-accent/10 rounded-xl p-6">
              <p className="text-sm text-muted-dark uppercase tracking-wider mb-2">Average ROI</p>
              <p className="font-number text-4xl font-bold text-foreground">
                {stats?.avg_roi !== null && stats?.avg_roi !== undefined
                  ? `${stats.avg_roi > 0 ? '+' : ''}${stats.avg_roi.toFixed(1)}%`
                  : '—'}
              </p>
              <p className="text-xs text-muted-dark mt-2">Return on investment across all tracked bets</p>
            </div>
            <div className="bg-card border border-accent/10 rounded-xl p-6">
              <p className="text-sm text-muted-dark uppercase tracking-wider mb-2">Profitable Bettors</p>
              <p className="font-number text-4xl font-bold text-foreground">{fmtPct(stats?.profitable_percentage)}</p>
              <p className="text-xs text-muted-dark mt-2">
                {stats?.profitable_bettors ?? 0} of {stats?.scored_users ?? 0} scored bettors have positive ROI
              </p>
            </div>
          </div>
        </section>

        {/* Score Distribution */}
        {stats?.score_distribution && stats.score_distribution.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground mb-6">
              Score Distribution
            </h2>
            <p className="text-sm text-muted-dark mb-4">
              How Gammbler Scores are distributed across all scored bettors. Scores range from 0–100.
            </p>
            <div className="bg-card border border-accent/10 rounded-xl p-6">
              <div className="flex items-end gap-2 h-48">
                {stats.score_distribution.map((bucket) => {
                  const maxCount = Math.max(...stats.score_distribution.map(b => b.count));
                  const height = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
                  return (
                    <div key={bucket.range} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-dark font-number">{bucket.count}</span>
                      <div
                        className="w-full bg-accent/70 rounded-t"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                      <span className="text-[10px] text-muted-dark font-number">{bucket.range}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Sport Breakdown */}
        {stats?.sport_breakdown && stats.sport_breakdown.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground mb-6">
              Performance by Sport
            </h2>
            <div className="bg-card border border-accent/10 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-accent/10">
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-dark font-bold">Sport</th>
                    <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-dark font-bold">Avg Score</th>
                    <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-dark font-bold">Avg Win Rate</th>
                    <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-dark font-bold">Avg ROI</th>
                    <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-dark font-bold">Scored Bettors</th>
                    <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-dark font-bold" />
                  </tr>
                </thead>
                <tbody>
                  {stats.sport_breakdown.map((sport) => (
                    <tr key={sport.sport} className="border-b border-accent/5 hover:bg-accent/5 transition-colors">
                      <td className="p-4 font-bold text-foreground">{SPORT_LABELS[sport.sport] || sport.sport}</td>
                      <td className="p-4 text-right font-number text-foreground">{fmt(sport.avg_score)}</td>
                      <td className="p-4 text-right font-number text-foreground">{fmtPct(sport.avg_win_rate ? sport.avg_win_rate * 100 : null)}</td>
                      <td className="p-4 text-right font-number text-foreground">
                        {sport.avg_roi !== null ? `${sport.avg_roi > 0 ? '+' : ''}${sport.avg_roi.toFixed(1)}%` : '—'}
                      </td>
                      <td className="p-4 text-right font-number text-muted-dark">{sport.total_scored}</td>
                      <td className="p-4 text-right">
                        <Link href={`/stats/${sport.sport}`} className="text-xs text-accent hover:text-accent-light">
                          Details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Bet Type Distribution */}
        {stats?.bet_type_distribution && stats.bet_type_distribution.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground mb-6">
              Bet Type Distribution
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {stats.bet_type_distribution.map((bt) => {
                const pct = stats.total_bets > 0 ? ((bt.total / stats.total_bets) * 100).toFixed(1) : '0';
                return (
                  <div key={bt.bet_type} className="bg-card border border-accent/10 rounded-xl p-4 text-center">
                    <p className="text-xs text-muted-dark uppercase tracking-wider mb-1">
                      {bt.bet_type.replace('_', ' ')}
                    </p>
                    <p className="font-number text-2xl font-bold text-foreground">{pct}%</p>
                    <p className="text-[10px] text-muted-dark">{fmtInt(bt.total)} bets</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Cross Links */}
        <section className="border-t border-accent/10 pt-8">
          <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
            Explore More
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/leaderboard" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">Leaderboard</h3>
              <p className="text-sm text-muted-dark">See the top-ranked sports bettors on Gammbler</p>
            </Link>
            <Link href="/creators" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">Creators</h3>
              <p className="text-sm text-muted-dark">Follow verified sports betting creators</p>
            </Link>
            <Link href="/learn/profitable-bettors-percentage" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">What % of Bettors Are Profitable?</h3>
              <p className="text-sm text-muted-dark">Data-backed analysis from real betting records</p>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

function MetricCard({ label, value, subtitle }: { label: string; value: string; subtitle?: string }) {
  return (
    <div className="bg-card border border-accent/10 rounded-xl p-6">
      <p className="text-xs text-muted-dark uppercase tracking-wider mb-2">{label}</p>
      <p className="font-number text-3xl font-bold text-foreground">{value}</p>
      {subtitle && <p className="text-[10px] text-muted-dark mt-1">{subtitle}</p>}
    </div>
  );
}
