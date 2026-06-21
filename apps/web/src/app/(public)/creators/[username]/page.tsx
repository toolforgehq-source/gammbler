import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { publicFetch, CreatorProfile } from '@/lib/public-api';
import { personSchema, breadcrumbSchema } from '@/lib/structured-data';

type Params = Promise<{ username: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  const creator = await publicFetch<CreatorProfile>(`/creator/${username}`);
  if (!creator) return { title: 'Creator Not Found' };
  return {
    title: `${creator.display_name} — Sports Betting Creator on Gammbler`,
    description: `${creator.display_name} (@${creator.username}) is a verified sports betting creator on Gammbler${creator.verified_score !== null ? ` with a score of ${creator.verified_score.toFixed(1)}` : ''}. ${creator.bio || 'Follow for picks, analysis, and betting insights.'}`,
    openGraph: {
      title: `${creator.display_name} — Gammbler Creator`,
      description: creator.bio || `Sports betting creator with verified performance data.`,
      type: 'profile',
    },
  };
}

function tierFromScore(score: number): string {
  if (score >= 90) return 'Legend';
  if (score >= 75) return 'Elite';
  if (score >= 60) return 'Veteran';
  if (score >= 40) return 'Contender';
  return 'Rookie';
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

const SPORT_LABELS: Record<string, string> = {
  overall: 'Overall', nfl: 'NFL', nba: 'NBA', mlb: 'MLB', nhl: 'NHL',
  cfb: 'CFB', cbb: 'CBB', soccer: 'Soccer', prizepicks: 'PrizePicks', dfs: 'DFS',
};

export default async function CreatorProfilePage({ params }: { params: Params }) {
  const { username } = await params;
  const creator = await publicFetch<CreatorProfile>(`/creator/${username}`);
  if (!creator) notFound();

  const tier = creator.verified_score !== null ? tierFromScore(creator.verified_score) : null;
  const sports = Array.isArray(creator.favorite_sports) ? (creator.favorite_sports as string[]) : [];
  const teams = Array.isArray(creator.favorite_teams) ? (creator.favorite_teams as string[]) : [];
  const totalBets = creator.record.wins + creator.record.losses + creator.record.pushes;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      mainEntity: {
        '@type': 'Person',
        name: creator.display_name,
        alternateName: creator.username,
        url: `https://gammbler.com/creators/${creator.username}`,
        description: creator.bio || `Sports betting creator on Gammbler`,
        knowsAbout: ['Sports Betting', ...sports],
        memberOf: {
          '@type': 'Organization',
          name: 'Gammbler',
          url: 'https://gammbler.com',
        },
      },
    },
    personSchema({
      username: creator.display_name,
      score: creator.verified_score ?? undefined,
      tier: tier ?? 'Creator',
      description: `${creator.display_name} — verified sports betting creator on Gammbler. Record: ${creator.record.wins}W-${creator.record.losses}L-${creator.record.pushes}P.`,
    }),
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Creators', url: '/creators' },
      { name: creator.display_name, url: `/creators/${creator.username}` },
    ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-dark mb-6">
          <Link href="/creators" className="hover:text-accent">Creators</Link>
          <span>/</span>
          <span className="text-foreground">{creator.display_name}</span>
        </nav>

        {/* Profile Header */}
        <div className="bg-card border border-accent/10 rounded-2xl overflow-hidden mb-8">
          {creator.banner_url && (
            <div className="h-32 bg-gradient-to-r from-accent/20 to-accent/5" />
          )}
          <div className="p-8">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="flex-1">
                <h1 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight text-foreground mb-1">
                  {creator.display_name}
                </h1>
                <p className="text-muted-dark mb-3">@{creator.username}</p>
                {creator.bio && (
                  <p className="text-sm text-foreground/80 mb-4 max-w-xl">{creator.bio}</p>
                )}
                <div className="flex flex-wrap gap-4 text-sm text-muted-dark">
                  {creator.total_subscribers > 0 && <span><strong className="text-foreground">{creator.total_subscribers}</strong> subscribers</span>}
                  {creator.total_followers > 0 && <span><strong className="text-foreground">{creator.total_followers}</strong> followers</span>}
                  {creator.total_tails > 0 && <span><strong className="text-foreground">{creator.total_tails}</strong> tails</span>}
                </div>
              </div>
              {creator.verified_score !== null && tier && (
                <div className="text-center">
                  <p className="text-xs text-muted-dark uppercase tracking-wider mb-1">Verified Score</p>
                  <p className={`font-number text-5xl font-bold ${tierColor(tier)}`}>
                    {creator.verified_score.toFixed(1)}
                  </p>
                  <p className={`text-sm font-bold ${tierColor(tier)}`}>{tier}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-accent/10 rounded-xl p-5">
            <p className="text-xs text-muted-dark uppercase tracking-wider mb-1">Record</p>
            <p className="font-number text-2xl font-bold text-foreground">
              {creator.record.wins}-{creator.record.losses}-{creator.record.pushes}
            </p>
          </div>
          <div className="bg-card border border-accent/10 rounded-xl p-5">
            <p className="text-xs text-muted-dark uppercase tracking-wider mb-1">Total Bets</p>
            <p className="font-number text-2xl font-bold text-foreground">{totalBets}</p>
          </div>
          {creator.betting_style && (
            <div className="bg-card border border-accent/10 rounded-xl p-5">
              <p className="text-xs text-muted-dark uppercase tracking-wider mb-1">Style</p>
              <p className="text-lg font-bold text-foreground">{creator.betting_style}</p>
            </div>
          )}
          <div className="bg-card border border-accent/10 rounded-xl p-5">
            <p className="text-xs text-muted-dark uppercase tracking-wider mb-1">Specialties</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {sports.slice(0, 3).map(s => (
                <span key={s} className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent rounded-full font-bold uppercase">{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Sport Scores */}
        {creator.scores.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              Scores by Sport
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {creator.scores.map(s => (
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

        {/* Favorite Teams */}
        {teams.length > 0 && (
          <section className="mb-8">
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground mb-4">
              Favorite Teams
            </h2>
            <div className="flex flex-wrap gap-2">
              {teams.map(t => (
                <span key={t} className="px-3 py-1 bg-card border border-accent/10 rounded-full text-sm text-foreground">{t}</span>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="bg-card border border-accent/20 rounded-xl p-8 text-center mb-8">
          <h2 className="font-display text-xl font-bold text-foreground mb-2">
            Subscribe to {creator.display_name}
          </h2>
          <p className="text-sm text-muted-dark mb-4">Get access to their picks, analysis, and betting insights on Gammbler.</p>
          <Link
            href="/signup"
            className="inline-block bg-accent hover:bg-accent-light text-background text-sm font-bold px-6 py-3 rounded-lg transition-colors"
          >
            Sign Up to Subscribe
          </Link>
        </div>

        {/* Cross Links */}
        <section className="border-t border-accent/10 pt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href={`/score/${creator.username}`} className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">Full Score Profile</h3>
              <p className="text-sm text-muted-dark">See {creator.display_name}&apos;s complete betting record</p>
            </Link>
            <Link href="/creators" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">All Creators</h3>
              <p className="text-sm text-muted-dark">Browse all verified creators</p>
            </Link>
            <Link href="/leaderboard" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">Leaderboard</h3>
              <p className="text-sm text-muted-dark">See the top-ranked bettors</p>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
