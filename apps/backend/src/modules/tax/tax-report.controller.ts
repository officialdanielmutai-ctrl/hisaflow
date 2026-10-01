import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { RolesGuard } from '../../core/guards/roles.guard';
import { Roles, AppRole } from '../../core/decorators/roles.decorator';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { TaxReportService } from './tax-report.service';

/**
 * Phase D — read-only Tax tab data. There is no write/edit route here by
 * design: tax is calculated and filed automatically, this only reports it.
 */
@UseGuards(ClerkAuthGuard, RolesGuard)
@Controller('tax')
export class TaxReportController {
  constructor(private readonly report: TaxReportService) {}

  @Roles(AppRole.OWNER, AppRole.MANAGER, AppRole.STAFF)
  @Get('report')
  getReport(
    @OrgContext() organizationId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.report.getReport(organizationId, { from, to });
  }
}
