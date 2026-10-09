import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { siteUrl } from '@/features/marketing/config/site';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-marketing',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: 'HisaFlow: Run your shop, guest house or ISP from one app',
  description:
    'Inventory, billing and daily operations for Kenyan small businesses. Built to work with M-Pesa. Start a 14-day free trial.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'HisaFlow: Run your business from one app',
    description:
      'Inventory, billing and daily operations for Kenyan small businesses. Built to work with M-Pesa.',
    type: 'website',
    siteName: 'HisaFlow',
    locale: 'en_KE',
  },
  robots: { index: true, follow: true },
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${jakarta.variable} mk-page min-h-screen`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--mk-r-pill)] focus:bg-[var(--mk-ink)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <main id="main">{children}</main>
    </div>
  );
}
