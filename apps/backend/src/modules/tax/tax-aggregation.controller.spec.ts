import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY, AppRole } from '../../core/decorators/roles.decorator';
import { FEATURES_KEY } from '../../core/decorators/requires-features.decorator';
import { TierFeature } from '../../core/entitlements/entitlements.constant';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { TaxAggregationController } from './tax-aggregation.controller';

/**
 * Proves the multi-location gate is actually wired to the aggregated tax
 * route, and that it is the *existing* MultiLocation feature (not a
 * tax-specific one).
 */
describe('TaxAggregationController gating (Phase F)', () => {
  const handler = TaxAggregationController.prototype.getView;

  it('reuses the existing MultiLocation feature gate', () => {
    expect(Reflect.getMetadata(FEATURES_KEY, handler)).toEqual([
      TierFeature.MultiLocation,
    ]);
  });

  it('runs the auth + roles guard, which executes the tier check', () => {
    const guards =
      Reflect.getMetadata(GUARDS_METADATA, TaxAggregationController) ?? [];
    expect(guards).toContain(ClerkAuthGuard);
    expect(guards).toContain(RolesGuard);
  });

  it('restricts the route to organisation member roles', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, handler) ?? [];
    expect(roles).toEqual(
      expect.arrayContaining([AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF]),
    );
  });
});
