import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { PrismaService } from '../../../infrastructure/prisma.service';

@UseGuards(AdminAuthGuard, AdminRoleGuard)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('kpis')
  async getKpis() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [
      totalOrganizations,
      newOrgsThisWeek,
      totalUsers,
      totalSubscribers,
      activeRouters,
      openAlerts,
      recentAuditLogs,
    ] = await Promise.all([
      this.prisma.db.organization.count(),
      this.prisma.db.organization.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      this.prisma.db.user.count(),
      this.prisma.db.subscriber.count(),
      this.prisma.db.router.count({ where: { connectionStatus: 'CONNECTED' } }),
      this.prisma.db.alert.count({ where: { status: 'UNRESOLVED' } }),
      this.prisma.db.adminAuditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
    ]);

    return {
      kpis: {
        activeOrganizations: totalOrganizations,
        newSignupsThisWeek: newOrgsThisWeek,
        totalUsers,
        totalSubscribers,
        activeRouters,
        openAlerts,
        aiProviderHealth: 'HEALTHY',
      },
      recentActivity: recentAuditLogs,
    };
  }
}
