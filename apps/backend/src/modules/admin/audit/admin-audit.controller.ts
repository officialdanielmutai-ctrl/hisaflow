import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { RequireAdminRoles } from '../decorators/require-admin-roles.decorator';
import { AdminRole } from '@prisma/client';
import { AdminAuditService, QueryAuditLogsDto } from './admin-audit.service';

@UseGuards(AdminAuthGuard, AdminRoleGuard)
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private readonly auditService: AdminAuditService) {}

  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  @Get()
  async getAuditLogs(@Query() query: QueryAuditLogsDto) {
    return this.auditService.findLogs(query);
  }

  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  @Get('meta')
  async getAuditMeta() {
    return this.auditService.getAuditMeta();
  }

  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  @Get('export')
  async exportCsv(@Query() query: QueryAuditLogsDto, @Res() res: Response) {
    const { csvContent, sha256 } = await this.auditService.exportCsvWithChecksum(query);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=admin-audit-logs-${Date.now()}.csv`);
    res.setHeader('X-Integrity-SHA256', sha256);
    return res.status(200).send(csvContent);
  }
}
