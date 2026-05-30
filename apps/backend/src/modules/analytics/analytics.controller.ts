import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';

@UseGuards(ClerkAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  async getDashboard(@OrgContext() organizationId: string) {
    const [snapshot, attentionFeed, inventoryHealth] = await Promise.all([
      this.analyticsService.getOperationalSnapshot(organizationId),
      this.analyticsService.getAttentionFeed(organizationId),
      this.analyticsService.getInventoryHealth(organizationId),
    ]);

    return { snapshot, attentionFeed, inventoryHealth };
  }

  @Get('attention-feed')
  getAttentionFeed(@OrgContext() organizationId: string) {
    return this.analyticsService.getAttentionFeed(organizationId);
  }

  @Get('snapshot')
  getSnapshot(@OrgContext() organizationId: string) {
    return this.analyticsService.getOperationalSnapshot(organizationId);
  }
}
