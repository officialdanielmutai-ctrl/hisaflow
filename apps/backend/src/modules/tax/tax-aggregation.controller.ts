import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';
import { RequiresFeatures } from '../../core/decorators/requires-features.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { TierFeature } from '../../core/entitlements/entitlements.constant';
import { TaxAggregationService } from './tax-aggregation.service';

/**
 * Phase F — multi-location aggregated tax view.
 *
 * Gated by the **existing** `MultiLocation` capability (Growth) — the same one
 * the ISP vertical's second router uses — rather than a tax-specific gate. The
 * service asserts it too, and a Solo/Team org is routed to the paywall
 * (`?feature=multi-location`).
 */
@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('tax')
export class TaxAggregationController {
  constructor(private readonly aggregation: TaxAggregationService) {}

  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @RequiresFeatures(TierFeature.MultiLocation)
  @Get('aggregate')
  getView(
    @OrgContext() organizationId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.aggregation.getAggregatedView(organizationId, { from, to });
  }
}
