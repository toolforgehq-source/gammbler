import { Metadata } from 'next';
import Link from 'next/link';
import { publicFetch, CreatorListResponse } from '@/lib/public-api';
import { breadcrumbSchema } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Sports Betting Creators — Verified Cappers | Gammbler',
  description: 'Browse verified sports betting creators on Gammbler. Follow creators with transparent records, verified scores, and real betting performance data.',
  openGraph: {
    title: 'Sports Betting Creators | Gammbler',
    description: 'Verified sports betting creators with transparent records and real performance data.',
    type: 'website',
  },
};

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

export default async function CreatorsPage() {
  const data = await publicFetch<CreatorListResponse>('/creators');

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Sports Betting Creators on Gammbler',
      description: 'Verified sports betting creators with transparent records and real performance data.',
      url: 'https://gammbler.com/creators',
      numberOfItems: data?.total ?? 0,
      itemListElement: (data?.creators ?? []).map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Person',
          name: c.display_name,
          url: `https://gammbler.com/creators/${c.username}`,
          description: c.bio || `Sports betting creator on Gammbler`,
        },
      })),
    },
    breadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Creators', url: '/creators' },
    ]),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <h1 className="font-display text-4xl md:text-5xl font-black uppercase tracking-tight text-foreground mb-4">
            Sports Betting Creators
          </h1>
          <p className="text-lg text-muted-dark max-w-3xl">
            Verified creators with transparent betting records. Every creator&apos;s score is earned from real, tracked bets — not self-reported.
          </p>
        </div>

        {data && data.creators.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.creators.map((creator) => {
              const tier = creator.verified_score ? tierFromScore(creator.verified_score) : 'Rookie';
              const sports = Array.isArray(creator.favorite_sports) ? (creator.favorite_sports as string[]) : [];
              return (
                <Link
                  key={creator.username}
                  href={`/creators/${creator.username}`}
                  className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors group"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex-1">
                      <h2 className="font-display text-lg font-bold text-foreground group-hover:text-accent transition-colors">
                        {creator.display_name}
                      </h2>
                      <p className="text-sm text-muted-dark">@{creator.username}</p>
                    </div>
                    {creator.verified_score !== null && (
                      <div className="text-right">
                        <p className={`font-number text-2xl font-bold ${tierColor(tier)}`}>
                          {creator.verified_score.toFixed(1)}
                        </p>
                        <p className={`text-[10px] font-bold ${tierColor(tier)}`}>{tier}</p>
                      </div>
                    )}
                  </div>
                  {creator.bio && (
                    <p className="text-sm text-muted-dark mb-3 line-clamp-2">{creator.bio}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {sports.slice(0, 3).map(s => (
                        <span key={s} className="text-[10px] px-2 py-0.5 bg-accent/10 text-accent rounded-full font-bold uppercase">
                          {s}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-3 text-xs text-muted-dark">
                      {creator.total_subscribers > 0 && <span>{creator.total_subscribers} subs</span>}
                      {creator.total_followers > 0 && <span>{creator.total_followers} followers</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-card border border-accent/10 rounded-xl p-12 text-center">
            <p className="text-muted-dark mb-4">No creators yet. Be the first.</p>
            <Link href="/signup" className="bg-accent hover:bg-accent-light text-background text-sm font-bold px-6 py-3 rounded-lg transition-colors">
              Sign Up Free
            </Link>
          </div>
        )}

        {/* CTA */}
        <div className="mt-12 bg-card border border-accent/20 rounded-xl p-8 text-center">
          <h2 className="font-display text-xl font-bold text-foreground mb-2">Become a Creator</h2>
          <p className="text-sm text-muted-dark mb-4">Share your picks, build your audience, and earn from your expertise.</p>
          <Link
            href="/signup"
            className="inline-block bg-accent hover:bg-accent-light text-background text-sm font-bold px-6 py-3 rounded-lg transition-colors"
          >
            Get Started
          </Link>
        </div>

        {/* Cross Links */}
        <section className="border-t border-accent/10 pt-8 mt-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/leaderboard" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">Leaderboard</h3>
              <p className="text-sm text-muted-dark">See the top-ranked bettors</p>
            </Link>
            <Link href="/stats" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">Statistics</h3>
              <p className="text-sm text-muted-dark">Platform-wide betting performance data</p>
            </Link>
            <Link href="/learn/sports-betting-creators" className="bg-card border border-accent/10 rounded-xl p-6 hover:border-accent/30 transition-colors">
              <h3 className="font-display font-bold text-foreground mb-1">How Creators Earn</h3>
              <p className="text-sm text-muted-dark">Learn about the creator monetization model</p>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
