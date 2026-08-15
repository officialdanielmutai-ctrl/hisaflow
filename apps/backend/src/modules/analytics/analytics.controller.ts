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

  @Get('guesthouse-dashboard')
  getGuestHouseDashboard(@OrgContext() organizationId: string) {
    return this.analyticsService.getGuestHouseDashboard(organizationId);
  }

  @Get('school-dashboard')
  getSchoolDashboard(@OrgContext() organizationId: string) {
    return this.analyticsService.getSchoolDashboard(organizationId);
  }

  @Get('chemist-dashboard')
  getChemistDashboard(@OrgContext() organizationId: string) {
    return this.analyticsService.getChemistDashboard(organizationId);
  }

  @Get('restaurant-dashboard')
  getRestaurantDashboard(@OrgContext() organizationId: string) {
    return this.analyticsService.getRestaurantDashboard(organizationId);
  }

  @Get('wholesale-dashboard')
  getWholesaleDashboard(@OrgContext() organizationId: string) {
    return this.analyticsService.getWholesaleDashboard(organizationId);
  }
}

