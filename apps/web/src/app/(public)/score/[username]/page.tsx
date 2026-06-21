import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicFetch, PublicProfile } from '@/lib/public-api';
import { profilePageSchema, personSchema, breadcrumbSchema } from '@/lib/structured-data';

type Params = Promise<{ username: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  const profile = await publicFetch<PublicProfile>(`/profile/${username}`);
  if (!profile) return { title: 'Bettor Not Found' };
  return {
    title: `${profile.username}'s Gammbler Score — ${profile.overall_score.toFixed(1)} (${profile.tier}) | Gammbler`,
    description: `${profile.username} has a Gammbler Score of ${profile.overall_score.toFixed(1)} (${profile.tier}). Record: ${profile.record.wins}W-${profile.record.losses}L-${profile.record.pushes}P.${profile.roi !== null ? ` ROI: ${profile.roi > 0 ? '+' : ''}${profile.roi.toFixed(1)}%.` : ''} Ranked #${profile.national_rank ?? 'N/A'} nationally.`,
    openGraph: {
      title: `${profile.username}'s Gammbler Score — ${profile.overall_score.toFixed(1)}`,
      description: `${profile.tier} tier bettor with a ${profile.record.wins}-${profile.record.losses}-${profile.record.pushes} record.`,
      type: 'profile',
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

function tierBorder(tier: string): string {
  switch (tier) {
    case 'Legend': return 'border-gold/40';
    case 'Elite': return 'border-gold/30';
    case 'Veteran': return 'border-accent/40';
    default: return 'border-accent/10';
  }
}

const SPORT_LABELS: Record<string, string> = {
  overall: 'Overall', nfl: 'NFL', nba: 'NBA', mlb: 'MLB', nhl: 'NHL',
  cfb: 'CFB', cbb: 'CBB', soccer: 'Soccer', prizepicks: 'PrizePicks', dfs: 'DFS',
};

export default async function ScorePage({ params }: { params: Params }) {
  const { username } = await params;
  const profile = await publicFetch<PublicProfile>(`/profile/${username}`);
  if (!profile) notFound();

  const jsonLd = [
    profilePageSchema({
      username: profile.username,
      score: profile.overall_score,
      tier: profile.tier,
      record: profile.record,
      roi: profile.roi,
    }),
    personSchema({
      username: profile.username,
      score: profile.overall_score,
      tier: profile.tier,
    }),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Leaderboard', url: '/leaderboard' },
      { name: profile.username, url: `/score/${profile.username}` },
    ]),
  ];

  const totalBets = profile.record.wins + profile.record.losses + profile.record.pushes;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-dark mb-6">
          <Link href="/leaderboard" className="hover:text-accent">Leaderboard</Link>
          <span>/</span>
          <span className="text-foreground">{profile.username}</span>
        </nav>

        {/* Profile Header */}
        <div className={`bg-card border ${tierBorder(profile.tier)} rounded-2xl p-8 mb-8`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex-1">
              <h1 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight text-foreground mb-2">
                {profile.username}
              </h1>
              <div className="flex items-center gap-3 mb-4">
                <span className={`text-sm font-bold ${tierColor(profile.tier)}`}>{profile.tier}</span>
                {profile.national_rank && (
                  <span className="text-sm text-muted-dark">Ranked #{profile.national_rank} nationally</span>
                )}
              </div>
              <p className="text-sm text-muted-dark">
                Member since {new Date(profile.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                {profile.followers > 0 && ` — ${profile.followers} follower${profile.followers !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-dark uppercase tracking-wider mb-1">Gammbler Score</p>
              <p className={`font-number text-6xl font-bold ${tierColor(profile.tier)}`}>
                {profile.overall_score.toFixed(1)}
              </p>
            </div>
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-accent/10 rounded-xl p-5">
            <p className="text-xs text-muted-dark uppercase tracking-wider mb-1">Record</p>
            <p className="font-number text-2xl font-bold text-foreground">
              {profile.record.wins}-{profile.record.losses}-{profile.record.pushes}
            </p>
          </div>
          <div className="bg-card border border-accent/10 rounded-xl p-5">
            <p className="text-xs text-muted-dark uppercase tracking-wider mb-1">Win Rate</p>
            <p className="font-number text-2xl font-bold text-foreground">
              {profile.win_rate !== null ? `${(profile.win_rate * 100).toFixed(1)}%` : '—'}
            </p>
          </div>
          <div className="bg-card border border-accent/10 rounded-xl p-5">
            <p className="text-xs text-muted-dark uppercase tracking-wider mb-1">ROI</p>
            <p className={`font-number text-2xl font-bold ${profile.roi !== null && profile.roi > 0 ? 'text-win' : profile.roi !== null && profile.roi < 0 ? 'text-loss' : 'text-foreground'}`}>
              {profile.roi !== null ? `${profile.roi > 0 ? '+' : ''}${profile.roi.toFixed(1)}%` : '—'}
            </p>
          </div>
          <div className="bg-card border border-accent/10 rounded-xl p-5">
            <p className="text-xs text-muted-dark uppercase tracking-wider mb-1">Total Bets</p>
            <p className="font-number text-2xl font-bold text-foreground">{totalBets}</p>
          </div>
        </div>

        {/* Sport Breakdown */}
        {profile.scores.length > 1 && (
          <section className="mb-8">
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              Scores by Sport
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {profile.scores
                .filter(s => s.sport !== 'overall')
                .sort((a, b) => b.score - a.score)
                .map(s => (
                  <div key={s.sport} className="bg-card border border-accent/10 rounded-xl p-5">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-bold text-foreground">{SPORT_LABELS[s.sport] || s.sport}</p>
                      <span className={`text-xs font-bold ${tierColor(s.tier)}`}>{s.tier}</span>
                    </div>
                    <p className="font-number text-3xl font-bold text-foreground mb-1">{s.score.toFixed(1)}</p>
                    <div className="flex gap-3 text-xs text-muted-dark">
                      {s.win_rate !== null && <span>WR: {(s.win_rate * 100).toFixed(1)}%</span>}
                      {s.roi !== null && <span>ROI: {s.roi > 0 ? '+' : ''}{s.roi.toFixed(1)}%</span>}
                      <span>{s.settled_bet_count} bets</span>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Badges */}
        {profile.badges.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              Badges
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.badges.map(b => (
                <span key={b.badge_type} className="px-3 py-1 bg-card border border-accent/20 rounded-full text-xs font-bold text-accent">
                  {b.badge_type.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="bg-card border border-accent/20 rounded-xl p-8 text-center mb-8">
          <h2 className="font-display text-xl font-bold text-foreground mb-2">Create Your Gammbler Score</h2>
          <p className="text-sm text-muted-dark mb-4">Track your bets, earn your score, and see how you stack up.</p>
          <Link
            href="/signup"
            className="inline-block bg-accent hover:bg-accent-light text-background text-sm font-bold px-6 py-3 rounded-lg transition-colors"
          >
            Sign Up Free
          </Link>
        </div>

        {/* Cross Links */}
        <section className="border-t border-accent/10 pt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/leaderboard" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">Leaderboard</h3>
              <p className="text-sm text-muted-dark">See all ranked bettors</p>
            </Link>
            <Link href="/stats" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">Statistics</h3>
              <p className="text-sm text-muted-dark">Platform-wide betting data</p>
            </Link>
            <Link href="/learn/how-gammbler-score-calculated" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">How Scores Work</h3>
              <p className="text-sm text-muted-dark">Learn about the Gammbler scoring system</p>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
