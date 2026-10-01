import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';
import { RequiresFeatures } from '../../core/decorators/requires-features.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { TierFeature } from '../../core/entitlements/entitlements.constant';
import { TaxReconciliationService } from './tax-reconciliation.service';

/**
 * Phase E — Team-tier reconciliation dashboard data.
 *
 * Explicitly gated to `TaxReconciliation` (Team), the Section 1A depth layer;
 * Solo gets the tax floor (filing/calculation/summary) but not this. The gate
 * is enforced by the same `RolesGuard` the rest of the codebase uses, so a Solo
 * org is routed to the paywall (`?feature=reconciliation`), and the service
 * asserts it too.
 */
@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('tax')
export class TaxReconciliationController {
  constructor(
    private readonly reconciliation: TaxReconciliationService,
  ) {}

  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @RequiresFeatures(TierFeature.TaxReconciliation)
  @Get('reconciliation')
  getReport(
    @OrgContext() organizationId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reconciliation.getReport(organizationId, { from, to });
  }
}
