import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Get('overview')
  getOverview(@OrgContext() orgId: string) {
    return this.financeService.getOverview(orgId);
  }

  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Get('forecast')
  getForecast(@OrgContext() orgId: string) {
    return this.financeService.getForecast(orgId);
  }

  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Get('price-suggestions')
  getPriceSuggestions(@OrgContext() orgId: string) {
    return this.financeService.getPriceSuggestions(orgId);
  }

  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Get('item/:id')
  getItemProfile(
    @Param('id') itemId: string,
    @OrgContext() orgId: string,
  ) {
    return this.financeService.getItemProfile(itemId, orgId);
  }
}
