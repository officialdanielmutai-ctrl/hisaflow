import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY, AppRole } from '../../core/decorators/roles.decorator';
import { FEATURES_KEY } from '../../core/decorators/requires-features.decorator';
import { TierFeature } from '../../core/entitlements/entitlements.constant';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { TaxReconciliationController } from './tax-reconciliation.controller';

/**
 * Proves the Team-tier gate is actually wired to the reconciliation route,
 * rather than assumed. If someone removes `@RequiresFeatures` (or the guard
 * that executes it), this fails.
 */
describe('TaxReconciliationController tier gating (Phase E)', () => {
  const handler = TaxReconciliationController.prototype.getReport;

  it('requires the Team-depth TaxReconciliation feature on the route', () => {
    expect(Reflect.getMetadata(FEATURES_KEY, handler)).toEqual([
      TierFeature.TaxReconciliation,
    ]);
  });

  it('runs the auth + roles guard, which executes the tier check', () => {
    const guards =
      Reflect.getMetadata(GUARDS_METADATA, TaxReconciliationController) ?? [];
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
