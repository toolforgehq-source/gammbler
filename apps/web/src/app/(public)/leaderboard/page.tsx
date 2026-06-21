import { Metadata } from 'next';
import Link from 'next/link';
import { publicFetch, LeaderboardResponse } from '@/lib/public-api';
import { leaderboardSchema, breadcrumbSchema } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Sports Betting Leaderboard — Top Gammbler Scores',
  description: 'National sports betting leaderboard ranked by Gammbler Score. See the top-rated bettors across all sports with verified records, win rates, and ROI.',
  openGraph: {
    title: 'Sports Betting Leaderboard — Top Gammbler Scores',
    description: 'See the top-rated sports bettors ranked by Gammbler Score with verified records.',
    type: 'website',
  },
};

const SPORTS = [
  { key: 'overall', label: 'Overall' },
  { key: 'nfl', label: 'NFL' },
  { key: 'nba', label: 'NBA' },
  { key: 'mlb', label: 'MLB' },
  { key: 'nhl', label: 'NHL' },
  { key: 'cfb', label: 'CFB' },
  { key: 'cbb', label: 'CBB' },
  { key: 'soccer', label: 'Soccer' },
];

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

export default async function LeaderboardPage() {
  const data = await publicFetch<LeaderboardResponse>('/leaderboard/overall');

  const jsonLd = [
    leaderboardSchema('overall', data?.leaderboard?.map(e => ({ rank: e.rank, username: e.username, score: e.score })) ?? []),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Leaderboard', url: '/leaderboard' },
    ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="font-display text-4xl md:text-5xl font-black uppercase tracking-tight text-foreground mb-4">
            Sports Betting Leaderboard
          </h1>
          <p className="text-lg text-muted-dark max-w-3xl">
            Top sports bettors ranked by Gammbler Score. Every score is earned from real, tracked betting records.
          </p>
        </div>

        {/* Sport Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {SPORTS.map(s => (
            <Link
              key={s.key}
              href={s.key === 'overall' ? '/leaderboard' : `/leaderboard/${s.key}`}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                s.key === 'overall'
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
                  <td colSpan={6} className="p-8 text-center text-muted-dark">No ranked bettors yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <p className="text-sm text-muted-dark mt-4 text-center">
            Showing {data.leaderboard.length} of {data.total} ranked bettors
          </p>
        )}

        {/* Cross Links */}
        <section className="border-t border-accent/10 pt-8 mt-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/stats" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">Statistics</h3>
              <p className="text-sm text-muted-dark">Platform-wide betting performance data</p>
            </Link>
            <Link href="/creators" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">Creators</h3>
              <p className="text-sm text-muted-dark">Follow verified sports betting creators</p>
            </Link>
            <Link href="/learn/sports-betting-leaderboards" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">How Leaderboards Work</h3>
              <p className="text-sm text-muted-dark">Learn about the Gammbler ranking system</p>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
