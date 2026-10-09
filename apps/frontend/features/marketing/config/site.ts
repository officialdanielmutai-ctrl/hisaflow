import type { HisaflowPlanTier } from '@/lib/plans';

/**
 * Site-level configuration for the public landing page.
 *
 * Contact details come from environment variables so no invented phone number
 * or mailbox can ever ship. When a value is missing the related CTA is omitted
 * rather than rendering a dead link (see `hisaflow-landing-visual-spec.md`
 * Section 15).
 */
export const SITE = {
  name: 'HisaFlow',
  tagline: 'Run your business from one app',
  whatsappNumber: (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '').replace(
    /[^\d]/g,
    '',
  ),
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '',
  company: 'HisaFlow',
} as const;

/**
 * Canonical origin for SEO metadata, sitemap and structured data.
 *
 * The domain was not decided in `hisaflow-landing-page.md` Section 8.7, so it
 * is defaulted to the most likely public origin and overridable in one place
 * via `NEXT_PUBLIC_SITE_URL` before launch.
 */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hisaflow.co.ke').replace(
    /\/+$/,
    '',
  );
}

/**
 * Origin of the authenticated app. The marketing site owns the apex domain and
 * the app can live on a subdomain (default `https://app.hisaflow.co.ke`). Set
 * `NEXT_PUBLIC_APP_URL` to the app origin in production; leave it unset for a
 * single-origin local setup, where every auth CTA stays a relative path.
 */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
}

/**
 * True only when the app origin is explicitly configured and differs from the
 * marketing origin. This keeps local development and unit tests on same-origin
 * relative links while production can split the two hosts.
 */
export function isSplitDeployment(): boolean {
  const app = appUrl();
  return app.length > 0 && app !== siteUrl();
}

/** Absolute app URL for a path, or a relative path when single-origin. */
export function appHref(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return isSplitDeployment() ? `${appUrl()}${clean}` : clean;
}

export type WhatsAppContext = 'general' | 'growth' | 'demo' | 'support';

const WHATSAPP_MESSAGES: Record<WhatsAppContext, string> = {
  general: 'Hi HisaFlow, I would like to learn more about the app.',
  growth: 'Hi HisaFlow, I run a multi-location business and would like to discuss the Growth plan.',
  demo: 'Hi HisaFlow, I would like to see a demo of the app.',
  support: 'Hi HisaFlow, I have a question about getting started.',
};

/** Returns a wa.me link with a context-aware pre-filled message, or null. */
export function whatsappHref(context: WhatsAppContext = 'general'): string | null {
  if (!SITE.whatsappNumber) return null;
  const text = encodeURIComponent(WHATSAPP_MESSAGES[context]);
  return `https://wa.me/${SITE.whatsappNumber}?text=${text}`;
}

/** Sign-up URL carrying advisory plan intent (never pricing logic). */
export function signUpHref(plan?: HisaflowPlanTier): string {
  const path = plan ? `/sign-up?plan=${plan.toLowerCase()}` : '/sign-up';
  return appHref(path);
}

/** Sign-in URL, pointed at the app origin when the two hosts are split. */
export function signInHref(): string {
  return appHref('/sign-in');
}

export function privacyHref(): string {
  return '/legal/privacy';
}

export function termsHref(): string {
  return '/legal/terms';
}
