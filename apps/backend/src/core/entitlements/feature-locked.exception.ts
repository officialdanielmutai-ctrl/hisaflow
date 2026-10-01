import { ForbiddenException } from '@nestjs/common';
import { HisaflowPlanTier } from '@prisma/client';

export type FeatureLockReason = 'feature_lock' | 'seat_limit';

export interface FeatureLockPayload {
  reason: FeatureLockReason;
  /** Paywall context key, e.g. 'staff', 'isp-routers'. */
  feature: string;
  requiredTier: HisaflowPlanTier;
  currentTier: HisaflowPlanTier | null;
  message: string;
}

/**
 * The single failure shape for every tier/seat gate. It carries enough context
 * for the client to route straight into the paywall with the blocked action
 * still attached (Section 2.1), instead of dead-ending on a generic pricing
 * page. `paywallUrl` is built here so backend and frontend agree on the shape.
 */
export class FeatureLockedException extends ForbiddenException {
  constructor(payload: FeatureLockPayload) {
    const params = new URLSearchParams({
      reason: payload.reason,
      feature: payload.feature,
    });
    super({
      statusCode: 403,
      error: 'Feature Locked',
      reason: payload.reason,
      feature: payload.feature,
      requiredTier: payload.requiredTier,
      currentTier: payload.currentTier,
      message: payload.message,
      paywallUrl: `/paywall?${params.toString()}`,
    });
  }
}
