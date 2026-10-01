/**
 * Pure paywall-context resolution (Section 2.1). Kept out of the React
 * component so the "blocked action -> paywall messaging" mapping can be tested
 * directly, including end-to-end with the backend's `paywallUrl`.
 *
 * Feature keys must match the backend `FeatureLockedException` (feature) and
 * `EntitlementsService` paywall keys.
 */

export interface PaywallContext {
  title: string;
  body: string;
}

export const FEATURE_MESSAGES: Record<string, PaywallContext> = {
  staff: {
    title: 'Add more staff with Team',
    body: 'Your current plan includes a single owner login. Team adds staff accounts with role-based permissions.',
  },
  'isp-routers': {
    title: 'Add another location with Growth',
    body: 'Managing more than one router or POP needs the Growth tier and its multi-location support.',
  },
  'multi-location': {
    title: 'Multi-location is a Growth feature',
    body: 'Growth adds multiple organization and location contexts, plus priority support.',
  },
  forecasting: {
    title: 'Demand forecasting is a Team feature',
    body: 'Team unlocks the intelligence layer: demand forecasting, slow-mover analysis and vertical analytics.',
  },
  reconciliation: {
    title: 'Reconciliation is a Team feature',
    body: 'Team adds filed-versus-collected reconciliation and anomaly flags ahead of filing deadlines.',
  },
};

export function resolvePaywallContext(input: {
  feature?: string;
  reason?: string;
}): PaywallContext | null {
  const { feature, reason } = input;

  if (feature && FEATURE_MESSAGES[feature]) {
    return FEATURE_MESSAGES[feature];
  }

  if (reason === 'seat_limit') {
    return {
      title: 'Add more staff with Team',
      body: 'You have reached the seats included in your current plan. Upgrade to add more staff accounts.',
    };
  }

  if (reason || feature) {
    return {
      title: 'Upgrade to unlock this feature',
      body: 'This action is available on a higher tier. Choose the plan that fits your business.',
    };
  }

  return null;
}
