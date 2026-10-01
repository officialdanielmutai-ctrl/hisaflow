import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../../core/guards/clerk-auth.guard';
import { HisaflowPlansService } from './hisaflow-plans.service';

/**
 * Active tiers for the paywall page. Only priced/active tiers are returned, so
 * the frontend never renders a card with no all-in price (Section 2.2).
 */
@Controller('paywall/plans')
@UseGuards(ClerkAuthGuard)
export class PlansController {
  constructor(private readonly plans: HisaflowPlansService) {}

  @Get()
  list() {
    return this.plans.listActive();
  }
}
