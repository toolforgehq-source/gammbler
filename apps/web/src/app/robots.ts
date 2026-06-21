import { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://gammbler.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/signin', '/forgot-password', '/reset-password', '/verify-email'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
