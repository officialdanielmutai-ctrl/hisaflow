import type { MetadataRoute } from 'next';
import { siteUrl } from '@/features/marketing/config/site';

/**
 * Public routes only. The authenticated app and the internal component gallery
 * are intentionally excluded (`hisaflow-landing-page.md` Section 5.4).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const lastModified = new Date();

  return [
    {
      url: `${base}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/legal/privacy`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/legal/terms`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
