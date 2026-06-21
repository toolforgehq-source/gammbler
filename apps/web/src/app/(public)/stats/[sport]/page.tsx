import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicFetch, SportStatsResponse } from '@/lib/public-api';
import { datasetSchema, breadcrumbSchema } from '@/lib/structured-data';

const SPORT_META: Record<string, { label: string; full: string }> = {
  nfl: { label: 'NFL', full: 'NFL Football' },
  nba: { label: 'NBA', full: 'NBA Basketball' },
  mlb: { label: 'MLB', full: 'MLB Baseball' },
  nhl: { label: 'NHL', full: 'NHL Hockey' },
  cfb: { label: 'CFB', full: 'College Football' },
  cbb: { label: 'CBB', full: 'College Basketball' },
  soccer: { label: 'Soccer', full: 'Soccer' },
};

const VALID_SPORTS = Object.keys(SPORT_META);

type Params = Promise<{ sport: string }>;

export async function generateStaticParams() {
  return VALID_SPORTS.map(sport => ({ sport }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { sport } = await params;
  const meta = SPORT_META[sport];
  if (!meta) return { title: 'Not Found' };
  return {
    title: `${meta.label} Betting Statistics — Average Win Rate, ROI, and Scores | Gammbler`,
    description: `${meta.full} betting statistics from real tracked bettors. Average ${meta.label} win rate, ROI, score distribution, and top performers based on actual betting records.`,
    openGraph: {
      title: `${meta.label} Betting Statistics | Gammbler`,
      description: `Real ${meta.full} betting performance data from tracked bettors on Gammbler.`,
      type: 'website',
    },
  };
}

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

function tierColor(tier: string): string {
  switch (tier) {
    case 'Legend': return 'text-gold';
    case 'Elite': return 'text-gold';
    case 'Veteran': return 'text-accent';
    case 'Contender': return 'text-accent-light';
    default: return 'text-muted-dark';
  }
}

export default async function SportStatsPage({ params }: { params: Params }) {
  const { sport } = await params;
  const meta = SPORT_META[sport];
  if (!meta) notFound();

  const stats = await publicFetch<SportStatsResponse>(`/stats/${sport}`);

  const jsonLd = [
    datasetSchema({
      name: `${meta.label} Betting Statistics — Gammbler`,
      description: `${meta.full} betting performance data: average win rate, ROI, score distribution, and top performers based on ${stats?.total_bets?.toLocaleString() ?? ''} tracked bets.`,
      url: `https://gammbler.com/stats/${sport}`,
      keywords: [`${meta.label} betting statistics`, `${meta.label} win rate`, `${meta.label} betting ROI`, `${meta.full} betting data`],
      totalBets: stats?.total_bets ?? undefined,
      totalUsers: stats?.scored_users ?? undefined,
    }),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Statistics', url: '/stats' },
      { name: `${meta.label} Stats`, url: `/stats/${sport}` },
    ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-dark mb-6">
          <Link href="/stats" className="hover:text-accent">Statistics</Link>
          <span>/</span>
          <span className="text-foreground">{meta.label}</span>
        </nav>

        <div className="mb-12">
          <h1 className="font-display text-4xl md:text-5xl font-black uppercase tracking-tight text-foreground mb-4">
            {meta.label} Betting Statistics
          </h1>
          <p className="text-lg text-muted-dark max-w-3xl">
            Real {meta.full.toLowerCase()} betting performance data from tracked bettors on Gammbler.
            Based on {fmtInt(stats?.total_bets)} tracked {meta.label} bets.
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="bg-card border border-accent/10 rounded-xl p-6">
            <p className="text-xs text-muted-dark uppercase tracking-wider mb-2">{meta.label} Bets Tracked</p>
            <p className="font-number text-3xl font-bold text-foreground">{fmtInt(stats?.total_bets)}</p>
          </div>
          <div className="bg-card border border-accent/10 rounded-xl p-6">
            <p className="text-xs text-muted-dark uppercase tracking-wider mb-2">Avg {meta.label} Score</p>
            <p className="font-number text-3xl font-bold text-foreground">{fmt(stats?.avg_score)}</p>
          </div>
          <div className="bg-card border border-accent/10 rounded-xl p-6">
            <p className="text-xs text-muted-dark uppercase tracking-wider mb-2">Avg Win Rate</p>
            <p className="font-number text-3xl font-bold text-foreground">{fmtPct(stats?.avg_win_rate ? stats.avg_win_rate * 100 : null)}</p>
          </div>
          <div className="bg-card border border-accent/10 rounded-xl p-6">
            <p className="text-xs text-muted-dark uppercase tracking-wider mb-2">Profitable</p>
            <p className="font-number text-3xl font-bold text-foreground">{fmtPct(stats?.profitable_percentage)}</p>
            <p className="text-[10px] text-muted-dark mt-1">{stats?.profitable_bettors ?? 0} of {stats?.scored_users ?? 0}</p>
          </div>
        </div>

        {/* Top 10 Performers */}
        {stats?.top_performers && stats.top_performers.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground mb-6">
              Top {meta.label} Bettors
            </h2>
            <div className="bg-card border border-accent/10 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-accent/10">
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-dark font-bold">Rank</th>
                    <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-dark font-bold">Bettor</th>
                    <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-dark font-bold">Score</th>
                    <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-dark font-bold">Win Rate</th>
                    <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-dark font-bold">ROI</th>
                    <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-dark font-bold">Bets</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_performers.map((p) => (
                    <tr key={p.username} className="border-b border-accent/5 hover:bg-accent/5 transition-colors">
                      <td className="p-4 font-number text-muted-dark">#{p.rank}</td>
                      <td className="p-4">
                        <Link href={`/score/${p.username}`} className="font-bold text-accent hover:text-accent-light">
                          {p.username}
                        </Link>
                        <span className={`ml-2 text-xs ${tierColor(p.tier)}`}>{p.tier}</span>
                      </td>
                      <td className="p-4 text-right font-number font-bold text-foreground">{fmt(p.score)}</td>
                      <td className="p-4 text-right font-number text-foreground">{fmtPct(p.win_rate ? p.win_rate * 100 : null)}</td>
                      <td className="p-4 text-right font-number text-foreground">
                        {p.roi !== null ? `${p.roi > 0 ? '+' : ''}${p.roi.toFixed(1)}%` : '—'}
                      </td>
                      <td className="p-4 text-right font-number text-muted-dark">{p.settled_bet_count}</td>
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
              {meta.label} Bet Type Distribution
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
                    <p className="text-[10px] text-muted-dark">{bt.total.toLocaleString()} bets</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Cross Links */}
        <section className="border-t border-accent/10 pt-8">
          <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
            Related
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href={`/leaderboard/${sport}`} className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">{meta.label} Leaderboard</h3>
              <p className="text-sm text-muted-dark">See the top-ranked {meta.full.toLowerCase()} bettors</p>
            </Link>
            <Link href="/stats" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">All Sports Statistics</h3>
              <p className="text-sm text-muted-dark">Compare performance across all sports</p>
            </Link>
            <Link href="/learn/good-betting-win-rate" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">What is a Good Win Rate?</h3>
              <p className="text-sm text-muted-dark">Data-backed answer from real betting records</p>
            </Link>
          </div>
        </section>

        {/* Other Sports */}
        <section className="mt-8 border-t border-accent/10 pt-8">
          <h3 className="font-display text-lg font-bold uppercase text-foreground mb-4">Other Sports</h3>
          <div className="flex flex-wrap gap-2">
            {VALID_SPORTS.filter(s => s !== sport).map(s => (
              <Link
                key={s}
                href={`/stats/${s}`}
                className="px-4 py-2 bg-card border border-accent/10 rounded-lg text-sm text-muted-dark hover:text-accent hover:border-accent/30 transition-colors"
              >
                {SPORT_META[s].label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
