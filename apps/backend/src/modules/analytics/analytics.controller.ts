import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Roles(AppRole.OWNER, AppRole.MANAGER)
  @Get('dashboard')
  getDashboard(@OrgContext() organizationId: string) {
    return this.analyticsService.getDashboardSummary(organizationId);
  }

  @Get('staff-dashboard')
  getStaffDashboard(@OrgContext() organizationId: string) {
    return this.analyticsService.getStaffDashboardSummary(organizationId);
  }
}
