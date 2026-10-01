import { HisaflowPlanTier } from '@prisma/client';

/**
 * Tier features, straight from the Section 1A floor/depth matrix. The floor is
 * identical across Solo and Team and is never gated; the depth layer is what
 * Team/Growth actually sell.
 *
 * This is the single source of truth for "what does tier-gating mean feature by
 * feature" — the backend gates and the paywall context keys both hang off it.
 */
export enum TierFeature {
  // ── Floor: available on every tier, never gated ──────────────────────────
  Receipts = 'receipts',
  TaxFiling = 'tax_filing',
  InventoryBasics = 'inventory_basics',
  FinanceBasics = 'finance_basics',
  VerticalBase = 'vertical_base',

  // ── Team depth ───────────────────────────────────────────────────────────
  RolePermissions = 'role_permissions',
  AnalyticsForecasting = 'analytics_forecasting',
  InventoryIntelligence = 'inventory_intelligence',
  FinanceTrends = 'finance_trends',
  TaxReconciliation = 'tax_reconciliation',
  VerticalDepth = 'vertical_depth',

  // ── Growth depth ─────────────────────────────────────────────────────────
  MultiLocation = 'multi_location',
  PrioritySupport = 'priority_support',
}

/** Rank lets us compare "is this tier at least X". */
export const TIER_RANK: Record<HisaflowPlanTier, number> = {
  SOLO: 1,
  TEAM: 2,
  GROWTH: 3,
};

/**
 * The minimum tier that unlocks each feature. Floor features list SOLO, which
 * means "allowed on any real tier" — callers still require an active
 * subscription/trial before treating the org as entitled at all.
 */
export const MIN_TIER_BY_FEATURE: Record<TierFeature, HisaflowPlanTier> = {
  [TierFeature.Receipts]: 'SOLO',
  [TierFeature.TaxFiling]: 'SOLO',
  [TierFeature.InventoryBasics]: 'SOLO',
  [TierFeature.FinanceBasics]: 'SOLO',
  [TierFeature.VerticalBase]: 'SOLO',

  [TierFeature.RolePermissions]: 'TEAM',
  [TierFeature.AnalyticsForecasting]: 'TEAM',
  [TierFeature.InventoryIntelligence]: 'TEAM',
  [TierFeature.FinanceTrends]: 'TEAM',
  [TierFeature.TaxReconciliation]: 'TEAM',
  [TierFeature.VerticalDepth]: 'TEAM',

  [TierFeature.MultiLocation]: 'GROWTH',
  [TierFeature.PrioritySupport]: 'GROWTH',
};

/** The Team trial default (Section 7 item 2): full Team features for 14 days. */
export const TRIAL_TIER: HisaflowPlanTier = 'TEAM';
export const TRIAL_SEAT_ALLOWANCE = 3;

export function tierAtLeast(
  candidate: HisaflowPlanTier | null,
  minimum: HisaflowPlanTier,
): boolean {
  if (!candidate) return false;
  return TIER_RANK[candidate] >= TIER_RANK[minimum];
}

export function featuresForTier(
  tier: HisaflowPlanTier | null,
): TierFeature[] {
  if (!tier) return [];
  return (Object.values(TierFeature) as TierFeature[]).filter((feature) =>
    tierAtLeast(tier, MIN_TIER_BY_FEATURE[feature]),
  );
}
