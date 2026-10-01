import { SetMetadata } from '@nestjs/common';
import { TierFeature } from '../entitlements/entitlements.constant';

export const FEATURES_KEY = 'tierFeatures';

/**
 * Extends the existing metadata-driven gate (`@Roles` / `@Permissions`) with a
 * tier dimension. Handled by the same `RolesGuard`, so there is no second
 * gating mechanism to learn — a vertical keeps its existing decorators and
 * adds this one where the Section 1A depth layer applies.
 */
export const RequiresFeatures = (...features: TierFeature[]) =>
  SetMetadata(FEATURES_KEY, features);
