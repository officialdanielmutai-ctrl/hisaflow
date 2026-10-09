import type { MetadataRoute } from 'next';
import { siteUrl } from '@/features/marketing/config/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/onboarding',
          '/paywall',
          '/settings',
          '/view-as',
          '/api/',
          '/gallery',
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
