import { FAQ as FAQ_CONTENT } from '@/features/marketing/config/content';
import { SITE, siteUrl } from '@/features/marketing/config/site';

/**
 * Structured data for search engines: Organization, WebSite and FAQPage.
 * Only true, shipped facts are described. `hisaflow-landing-page.md` Section 5.4.
 */
export function SiteJsonLd() {
  const url = siteUrl();

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${url}/#organization`,
        name: SITE.name,
        url,
        logo: `${url}/icons/icon-512.png`,
        areaServed: {
          '@type': 'Country',
          name: 'Kenya',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${url}/#website`,
        name: SITE.name,
        url,
        publisher: { '@id': `${url}/#organization` },
        inLanguage: 'en-KE',
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}/#faq`,
        mainEntity: FAQ_CONTENT.items.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
