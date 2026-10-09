/**
 * Single source of truth for HisaFlow plan tiers used across the paywall and
 * the public landing page.
 *
 * Prices mirror the backend seed (`DEFAULT_HISAFLOW_PLANS` in
 * `apps/backend/src/modules/paywall/plans/hisaflow-plans.service.ts`) and the
 * defaults recorded in `hisaflow-paywall.md` Section 7. Growth has no
 * published price by design, so it stays "Contact us" rather than inventing a
 * figure. Changing a value here changes the landing page; the paywall reads
 * live values from the backend at runtime.
 */

export type HisaflowPlanTier = 'SOLO' | 'TEAM' | 'GROWTH';

export const PLAN_TIERS: HisaflowPlanTier[] = ['SOLO', 'TEAM', 'GROWTH'];

/**
 * Normalises advisory plan intent from a `?plan=` query string. Invalid or
 * missing values return `null` so callers degrade gracefully instead of
 * guessing a purchase (`hisaflow-landing-page.md` Sections 5.2 and 7).
 */
export function normalizePlanIntent(
  value: string | null | undefined,
): HisaflowPlanTier | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return PLAN_TIERS.find((tier) => tier === upper) ?? null;
}

export const TIER_RANK: Record<HisaflowPlanTier, number> = {
  SOLO: 1,
  TEAM: 2,
  GROWTH: 3,
};

export interface TierContent {
  /** Who the tier is for, one short line. */
  audience: string;
  /** The differentiator the card leads with. */
  differentiator: string;
  /** Benefit-led bullets; avoid generic module names. */
  features: string[];
}

/**
 * Shared tier copy. The paywall's `TierCard` and the landing pricing section
 * both read from here so the two surfaces cannot drift.
 */
export const TIER_CONTENT: Record<HisaflowPlanTier, TierContent> = {
  SOLO: {
    audience: 'Single owner-operator',
    differentiator: '1 login · 1 location',
    features: [
      'Full inventory, invoicing and reporting',
      'Automatic tax calculated on every sale',
      'One vertical module at base depth',
    ],
  },
  TEAM: {
    audience: 'Owner with staff',
    differentiator: 'Up to 3 staff logins · role permissions',
    features: [
      'Everything in Solo',
      'Staff accounts with role-based permissions',
      'Full vertical depth, for example work orders assigned to technicians',
    ],
  },
  GROWTH: {
    audience: 'Multi-location operation',
    differentiator: 'Multiple locations · priority support',
    features: [
      'Everything in Team',
      'Multiple organization or location contexts',
      'Priority support',
    ],
  },
};

export interface MarketingPlan {
  tier: HisaflowPlanTier;
  name: string;
  /** KES per month. `null` means the tier is quoted on request (Growth). */
  priceKes: number | null;
  cta: 'signup' | 'whatsapp';
}

/** Display order for the public pricing section. */
export const MARKETING_PLANS: MarketingPlan[] = [
  { tier: 'SOLO', name: 'Solo', priceKes: 2500, cta: 'signup' },
  { tier: 'TEAM', name: 'Team', priceKes: 5500, cta: 'signup' },
  { tier: 'GROWTH', name: 'Growth', priceKes: null, cta: 'whatsapp' },
];
