const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gammbler.com';

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Gammbler',
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo-main.png`,
    description: 'Every bettor gets a score. Track your betting record, compete on national leaderboards, and share your Gammbler Score.',
    foundingDate: '2024',
    sameAs: [],
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Gammbler',
    url: SITE_URL,
    description: 'Sports betting analytics platform — track your record, earn your score, compete on leaderboards.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/leaderboard?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function personSchema(user: {
  username: string;
  score?: number;
  tier?: string;
  description?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: user.username,
    url: `${SITE_URL}/score/${user.username}`,
    description: user.description || `${user.username} has a Gammbler Score of ${user.score ?? 'N/A'} (${user.tier ?? 'Unranked'})`,
    knowsAbout: 'Sports Betting',
    memberOf: {
      '@type': 'Organization',
      name: 'Gammbler',
      url: SITE_URL,
    },
  };
}

export function leaderboardSchema(sport: string, entries: Array<{ rank: number; username: string; score: number }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${sport === 'overall' ? '' : sport.toUpperCase() + ' '}Sports Betting Leaderboard — Gammbler`,
    description: `Top sports bettors ranked by Gammbler Score${sport !== 'overall' ? ` for ${sport.toUpperCase()}` : ''}.`,
    url: `${SITE_URL}/leaderboard${sport !== 'overall' ? `/${sport}` : ''}`,
    numberOfItems: entries.length,
    itemListElement: entries.slice(0, 50).map(e => ({
      '@type': 'ListItem',
      position: e.rank,
      item: {
        '@type': 'Person',
        name: e.username,
        url: `${SITE_URL}/score/${e.username}`,
        description: `Gammbler Score: ${e.score}`,
      },
    })),
  };
}

export function datasetSchema(data: {
  name: string;
  description: string;
  url: string;
  keywords: string[];
  totalBets?: number;
  totalUsers?: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: data.name,
    description: data.description,
    url: data.url,
    keywords: data.keywords,
    creator: {
      '@type': 'Organization',
      name: 'Gammbler',
      url: SITE_URL,
    },
    license: `${SITE_URL}/terms`,
    ...(data.totalBets ? { measurementTechnique: `Based on ${data.totalBets.toLocaleString()} tracked bets from ${data.totalUsers?.toLocaleString() ?? 'many'} users` } : {}),
  };
}

export function articleSchema(article: {
  title: string;
  description: string;
  slug: string;
  datePublished?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    url: `${SITE_URL}/learn/${article.slug}`,
    datePublished: article.datePublished || '2024-01-01',
    dateModified: new Date().toISOString().split('T')[0],
    author: {
      '@type': 'Organization',
      name: 'Gammbler',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Gammbler',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/images/logo-main.png`,
      },
    },
    mainEntityOfPage: `${SITE_URL}/learn/${article.slug}`,
  };
}

export function faqSchema(questions: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(q => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  };
}

export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}

export function profilePageSchema(user: {
  username: string;
  score: number;
  tier: string;
  record: { wins: number; losses: number; pushes: number };
  roi: number | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: user.username,
      url: `${SITE_URL}/score/${user.username}`,
      description: `${user.username} — Gammbler Score: ${user.score} (${user.tier}). Record: ${user.record.wins}W-${user.record.losses}L-${user.record.pushes}P.${user.roi !== null ? ` ROI: ${user.roi > 0 ? '+' : ''}${user.roi.toFixed(1)}%` : ''}`,
      knowsAbout: 'Sports Betting',
    },
  };
}
