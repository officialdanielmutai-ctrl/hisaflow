import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TieredPricingService } from './tiered-pricing.service';
import { CreateTieredPriceRuleDto } from './dto/create-tiered-price-rule.dto';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('tiered-pricing')
export class TieredPricingController {
  constructor(private readonly tieredPricingService: TieredPricingService) {}

  @Get(':itemId')
  async getRulesByItem(
    @Param('itemId') itemId: string,
    @OrgContext() orgId: string,
  ) {
    return this.tieredPricingService.findByItem(itemId, orgId);
  }

  @Post(':itemId')
  async upsertRules(
    @Param('itemId') itemId: string,
    @Body() rules: CreateTieredPriceRuleDto[],
    @OrgContext() orgId: string,
  ) {
    return this.tieredPricingService.upsertRules(orgId, itemId, rules);
  }

  @Delete('rule/:id')
  async deleteRule(
    @Param('id') id: string,
    @OrgContext() orgId: string,
  ) {
    return this.tieredPricingService.deleteRule(id, orgId);
  }
}
