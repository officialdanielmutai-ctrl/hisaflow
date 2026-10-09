import { describe, it, expect, vi } from 'vitest';
import { MARKETING_PLANS, TIER_CONTENT, normalizePlanIntent } from '@/lib/plans';
import { CLAIMS, isLive, isVisible } from '@/features/marketing/config/claims';

/**
 * The public pricing surface and the paywall must read the same plan source
 * (`hisaflow-landing-page.md` Sections 5.3 and 7, Layer L-C). These tests fail
 * if the landing page starts inventing its own prices or gating claims.
 */
describe('marketing plan source of truth', () => {
  it('publishes the provisional paywall defaults and quotes Growth on request', () => {
    const byTier = Object.fromEntries(MARKETING_PLANS.map((p) => [p.tier, p]));

    expect(byTier.SOLO.priceKes).toBe(2500);
    expect(byTier.TEAM.priceKes).toBe(5500);
    expect(byTier.GROWTH.priceKes).toBeNull();
  });

  it('sends Growth to WhatsApp and the priced tiers to sign-up', () => {
    const byTier = Object.fromEntries(MARKETING_PLANS.map((p) => [p.tier, p]));

    expect(byTier.SOLO.cta).toBe('signup');
    expect(byTier.TEAM.cta).toBe('signup');
    expect(byTier.GROWTH.cta).toBe('whatsapp');
  });

  it('has copy for every published tier', () => {
    for (const plan of MARKETING_PLANS) {
      expect(TIER_CONTENT[plan.tier].differentiator.length).toBeGreaterThan(0);
      expect(TIER_CONTENT[plan.tier].features.length).toBeGreaterThan(0);
    }
  });
});

describe('claims gating', () => {
  it('only marks capabilities live when they are actually shipped', () => {
    expect(CLAIMS.mpesaPayments).toBe('live');
    // eTIMS production activation is not verified yet, so it is not claimed.
    expect(isLive(CLAIMS.taxEtims)).toBe(false);
    expect(CLAIMS.taxEtims).toBe('coming_soon');
    // Offline mode is hidden from copy entirely.
    expect(isVisible(CLAIMS.offlineMode)).toBe(false);
  });

  it('does not permit third-party payment logos before brand review', () => {
    expect(CLAIMS.paymentLogosPermitted).toBe(false);
  });
});

describe('normalizePlanIntent (Layer L-D)', () => {
  it('accepts valid intent in any case', () => {
    expect(normalizePlanIntent('team')).toBe('TEAM');
    expect(normalizePlanIntent('SOLO')).toBe('SOLO');
    expect(normalizePlanIntent('Growth')).toBe('GROWTH');
  });

  it('degrades gracefully for missing or invalid intent', () => {
    expect(normalizePlanIntent(null)).toBeNull();
    expect(normalizePlanIntent(undefined)).toBeNull();
    expect(normalizePlanIntent('')).toBeNull();
    expect(normalizePlanIntent('enterprise')).toBeNull();
    expect(normalizePlanIntent('team; DROP TABLE')).toBeNull();
  });
});

describe('signUpHref', () => {
  it('carries lower-case plan intent and omits it when absent', async () => {
    const { signUpHref } = await import(
      '@/features/marketing/config/site'
    );

    expect(signUpHref('TEAM')).toBe('/sign-up?plan=team');
    expect(signUpHref('SOLO')).toBe('/sign-up?plan=solo');
    expect(signUpHref()).toBe('/sign-up');
  });
});

describe('app origin split (NEXT_PUBLIC_APP_URL)', () => {
  it('keeps auth links relative when the app origin is not configured', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    const { signUpHref, signInHref, isSplitDeployment } = await import(
      '@/features/marketing/config/site'
    );

    expect(isSplitDeployment()).toBe(false);
    expect(signUpHref('TEAM')).toBe('/sign-up?plan=team');
    expect(signInHref()).toBe('/sign-in');
    vi.unstubAllEnvs();
  });

  it('points auth links at the app subdomain when it is configured', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.hisaflow.co.ke');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://hisaflow.co.ke');
    const { signUpHref, signInHref, isSplitDeployment, siteUrl } =
      await import('@/features/marketing/config/site');

    expect(isSplitDeployment()).toBe(true);
    expect(siteUrl()).toBe('https://hisaflow.co.ke');
    expect(signUpHref('TEAM')).toBe(
      'https://app.hisaflow.co.ke/sign-up?plan=team',
    );
    expect(signInHref()).toBe('https://app.hisaflow.co.ke/sign-in');
    vi.unstubAllEnvs();
  });
});

describe('whatsappHref', () => {
  it('returns null when no number is configured, so no dead link ships', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_WHATSAPP_NUMBER', '');
    const { whatsappHref } = await import('@/features/marketing/config/site');

    expect(whatsappHref('growth')).toBeNull();
  });

  it('builds a wa.me link with a context-aware pre-filled message', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_WHATSAPP_NUMBER', '+254 712 345 678');
    const { whatsappHref } = await import('@/features/marketing/config/site');
    const href = whatsappHref('growth');

    expect(href).toContain('https://wa.me/254712345678');
    expect(href).toContain(
      encodeURIComponent('Growth plan'),
    );
    vi.unstubAllEnvs();
  });
});
