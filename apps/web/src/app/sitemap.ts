import { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gammbler.com';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const SPORTS = ['nfl', 'nba', 'mlb', 'nhl', 'cfb', 'cbb', 'soccer'];
const LEARN_SLUGS = [
  'what-is-gammbler',
  'how-gammbler-score-calculated',
  'good-betting-win-rate',
  'good-betting-roi',
  'sports-betting-leaderboards',
  'sports-betting-creators',
  'track-betting-record',
  'profitable-bettors-percentage',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Static pages
  entries.push(
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/leaderboard`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/stats`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/creators`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/signup`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/responsible-gambling`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  );

  // Sport-specific leaderboard and stats pages
  for (const sport of SPORTS) {
    entries.push(
      { url: `${SITE_URL}/leaderboard/${sport}`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
      { url: `${SITE_URL}/stats/${sport}`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    );
  }

  // Knowledge pages
  for (const slug of LEARN_SLUGS) {
    entries.push(
      { url: `${SITE_URL}/learn/${slug}`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    );
  }

  // Dynamic pages from API
  try {
    const res = await fetch(`${API_URL}/public/sitemap-data`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();

      // Public score pages
      for (const username of (data.public_usernames || [])) {
        entries.push({
          url: `${SITE_URL}/score/${username}`,
          lastModified: new Date(),
          changeFrequency: 'daily',
          priority: 0.6,
        });
      }

      // Creator pages
      for (const username of (data.creator_usernames || [])) {
        entries.push({
          url: `${SITE_URL}/creators/${username}`,
          lastModified: new Date(),
          changeFrequency: 'daily',
          priority: 0.7,
        });
      }
    }
  } catch {
    // API unavailable — static pages only
  }

  return entries;
}
