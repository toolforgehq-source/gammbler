import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicFetch, LeaderboardResponse } from '@/lib/public-api';
import { leaderboardSchema, breadcrumbSchema } from '@/lib/structured-data';

const SPORT_META: Record<string, { label: string; full: string }> = {
  nfl: { label: 'NFL', full: 'NFL Football' },
  nba: { label: 'NBA', full: 'NBA Basketball' },
  mlb: { label: 'MLB', full: 'MLB Baseball' },
  nhl: { label: 'NHL', full: 'NHL Hockey' },
  cfb: { label: 'CFB', full: 'College Football' },
  cbb: { label: 'CBB', full: 'College Basketball' },
  soccer: { label: 'Soccer', full: 'Soccer' },
};

const ALL_SPORTS = [
  { key: 'overall', label: 'Overall' },
  ...Object.entries(SPORT_META).map(([key, val]) => ({ key, label: val.label })),
];

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
    title: `${meta.label} Betting Leaderboard — Top ${meta.full} Bettors | Gammbler`,
    description: `${meta.label} sports betting leaderboard ranked by Gammbler Score. See the best ${meta.full.toLowerCase()} bettors with verified records, win rates, and ROI.`,
    openGraph: {
      title: `${meta.label} Betting Leaderboard | Gammbler`,
      description: `Top ${meta.full.toLowerCase()} bettors ranked by Gammbler Score.`,
      type: 'website',
    },
  };
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

function tierBg(tier: string): string {
  switch (tier) {
    case 'Legend': return 'bg-gold/10 border-gold/30';
    case 'Elite': return 'bg-gold/5 border-gold/20';
    case 'Veteran': return 'bg-accent/10 border-accent/30';
    default: return 'bg-card border-accent/10';
  }
}

export default async function SportLeaderboardPage({ params }: { params: Params }) {
  const { sport } = await params;
  const meta = SPORT_META[sport];
  if (!meta) notFound();

  const data = await publicFetch<LeaderboardResponse>(`/leaderboard/${sport}`);

  const jsonLd = [
    leaderboardSchema(sport, data?.leaderboard?.map(e => ({ rank: e.rank, username: e.username, score: e.score })) ?? []),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Leaderboard', url: '/leaderboard' },
      { name: `${meta.label} Rankings`, url: `/leaderboard/${sport}` },
    ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-dark mb-6">
          <Link href="/leaderboard" className="hover:text-accent">Leaderboard</Link>
          <span>/</span>
          <span className="text-foreground">{meta.label}</span>
        </nav>

        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl font-black uppercase tracking-tight text-foreground mb-4">
            {meta.label} Betting Leaderboard
          </h1>
          <p className="text-lg text-muted-dark max-w-3xl">
            Top {meta.full.toLowerCase()} bettors ranked by Gammbler Score. Every score is earned from real, tracked betting records.
          </p>
        </div>

        {/* Sport Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {ALL_SPORTS.map(s => (
            <Link
              key={s.key}
              href={s.key === 'overall' ? '/leaderboard' : `/leaderboard/${s.key}`}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                s.key === sport
                  ? 'bg-accent text-background'
                  : 'bg-card border border-accent/10 text-muted-dark hover:text-accent hover:border-accent/30'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>

        {/* Leaderboard Table */}
        <div className="bg-card border border-accent/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-accent/10">
                <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-dark font-bold w-16">Rank</th>
                <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-dark font-bold">Bettor</th>
                <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-dark font-bold">Score</th>
                <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-dark font-bold hidden sm:table-cell">Win Rate</th>
                <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-dark font-bold hidden sm:table-cell">ROI</th>
                <th className="text-right p-4 text-xs uppercase tracking-wider text-muted-dark font-bold hidden md:table-cell">Bets</th>
              </tr>
            </thead>
            <tbody>
              {data?.leaderboard?.map((entry) => (
                <tr key={entry.username} className={`border-b border-accent/5 hover:bg-accent/5 transition-colors ${entry.rank <= 3 ? tierBg(entry.tier) : ''}`}>
                  <td className="p-4 font-number font-bold text-muted-dark">
                    {entry.rank <= 3 ? ['', '1st', '2nd', '3rd'][entry.rank] : `#${entry.rank}`}
                  </td>
                  <td className="p-4">
                    <Link href={`/score/${entry.username}`} className="font-bold text-accent hover:text-accent-light">
                      {entry.username}
                    </Link>
                    <span className={`ml-2 text-xs font-bold ${tierColor(entry.tier)}`}>{entry.tier}</span>
                  </td>
                  <td className="p-4 text-right font-number text-xl font-bold text-foreground">{entry.score.toFixed(1)}</td>
                  <td className="p-4 text-right font-number text-foreground hidden sm:table-cell">
                    {entry.win_rate !== null ? `${(entry.win_rate * 100).toFixed(1)}%` : '—'}
                  </td>
                  <td className="p-4 text-right font-number text-foreground hidden sm:table-cell">
                    {entry.roi !== null ? `${entry.roi > 0 ? '+' : ''}${entry.roi.toFixed(1)}%` : '—'}
                  </td>
                  <td className="p-4 text-right font-number text-muted-dark hidden md:table-cell">
                    {entry.settled_bet_count}
                  </td>
                </tr>
              )) ?? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-dark">No ranked {meta.label} bettors yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <p className="text-sm text-muted-dark mt-4 text-center">
            Showing {data.leaderboard.length} of {data.total} ranked {meta.label} bettors
          </p>
        )}

        {/* Cross Links */}
        <section className="border-t border-accent/10 pt-8 mt-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href={`/stats/${sport}`} className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">{meta.label} Statistics</h3>
              <p className="text-sm text-muted-dark">Average win rate, ROI, and score data for {meta.label}</p>
            </Link>
            <Link href="/stats" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">All Statistics</h3>
              <p className="text-sm text-muted-dark">Platform-wide betting performance data</p>
            </Link>
            <Link href="/creators" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">Creators</h3>
              <p className="text-sm text-muted-dark">Follow verified sports betting creators</p>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
