/**
 * Pure helpers for the Phase E billing screen. Kept dependency-free (like
 * `paywall-context.ts` / `feature-lock.ts`) so the "what happens when I change
 * plan" logic can be unit-tested without a browser or the API client.
 */

export type BillingTier = 'SOLO' | 'TEAM' | 'GROWTH';

export const TIER_ORDER: BillingTier[] = ['SOLO', 'TEAM', 'GROWTH'];

const TIER_RANK: Record<BillingTier, number> = {
  SOLO: 1,
  TEAM: 2,
  GROWTH: 3,
};

export type PlanDirection = 'upgrade' | 'downgrade' | 'same';

/**
 * The direction of a plan change. This is the load-bearing distinction for the
 * UI: upgrades take effect immediately, downgrades are deferred to renewal.
 */
export function planChangeDirection(
  current: BillingTier,
  target: BillingTier,
): PlanDirection {
  if (TIER_RANK[target] > TIER_RANK[current]) return 'upgrade';
  if (TIER_RANK[target] < TIER_RANK[current]) return 'downgrade';
  return 'same';
}

/** Human label for a tier, used on buttons and confirmations. */
export function describePlanDirection(direction: PlanDirection): string {
  switch (direction) {
    case 'upgrade':
      return 'Takes effect immediately';
    case 'downgrade':
      return 'Takes effect at your next renewal';
    default:
      return 'Current plan';
  }
}

/** Additional seats never go below zero (the tier base cannot be removed). */
export function clampAdditionalSeats(current: number, delta: number): number {
  return Math.max(0, current + delta);
}

export function additionalSeatsFrom(
  seatAllowance: number,
  baseAllowance: number,
): number {
  return Math.max(0, seatAllowance - baseAllowance);
}

export type InvoiceTone = 'success' | 'warning' | 'danger';

export function describeInvoiceStatus(status: string): {
  label: string;
  tone: InvoiceTone;
} {
  switch (status) {
    case 'SUCCESS':
      return { label: 'Paid', tone: 'success' };
    case 'PENDING':
      return { label: 'Pending', tone: 'warning' };
    case 'FAILED':
      return { label: 'Failed', tone: 'danger' };
    default:
      return { label: status, tone: 'warning' };
  }
}
