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
  @Get('export')
  async exportCsv(@Query() query: QueryAuditLogsDto, @Res() res: Response) {
    const logs = await this.auditService.findLogs({ ...query, limit: 1000, offset: 0 });

    const headers = ['Timestamp', 'Admin Name', 'Admin Email', 'Action', 'Target Type', 'Target ID', 'Target Label', 'Reason', 'IP Address'];
    const rows = logs.items.map((log: any) => [
      log.createdAt.toISOString(),
      `"${log.admin.name.replace(/"/g, '""')}"`,
      log.admin.email,
      log.actionType,
      log.targetType,
      log.targetId || '',
      `"${(log.targetLabel || '').replace(/"/g, '""')}"`,
      `"${(log.reason || '').replace(/"/g, '""')}"`,
      log.ipAddress || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=admin-audit-logs-${Date.now()}.csv`);
    return res.status(200).send(csvContent);
  }
}
