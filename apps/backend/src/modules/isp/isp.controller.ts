import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { PrismaService } from '../../infrastructure/prisma.service';
import { SubscriberStatus, WorkOrderStatus, TicketStatus } from '@prisma/client';

@UseGuards(ClerkAuthGuard)
@Controller('isp')
export class IspController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('dashboard')
  async getDashboard(@OrgContext() organizationId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalSubscribers,
      activeSubscribers,
      suspendedSubscribers,
      churnedSubscribers,
      openTickets,
      scheduledWorkOrders,
      monthlyRevenue,
    ] = await Promise.all([
      this.prisma.db.subscriber.count({ where: { organizationId } }),
      this.prisma.db.subscriber.count({ where: { organizationId, status: SubscriberStatus.ACTIVE } }),
      this.prisma.db.subscriber.count({ where: { organizationId, status: SubscriberStatus.SUSPENDED } }),
      this.prisma.db.subscriber.count({ where: { organizationId, status: SubscriberStatus.CHURNED } }),
      this.prisma.db.ticket.count({ where: { organizationId, status: TicketStatus.OPEN } }),
      this.prisma.db.workOrder.count({ where: { organizationId, status: WorkOrderStatus.SCHEDULED } }),
      this.prisma.db.invoice.aggregate({
        where: {
          organizationId,
          status: 'PAID',
          issuedAt: { gte: startOfMonth },
          subscriberId: { not: null },
        },
        _sum: { adjustmentsTotal: true },
      }),
    ]);

    const activeRate = totalSubscribers > 0
      ? Math.round((activeSubscribers / totalSubscribers) * 100)
      : 0;

    return {
      subscribers: {
        total: totalSubscribers,
        active: activeSubscribers,
        suspended: suspendedSubscribers,
        churned: churnedSubscribers,
        activeRate,
      },
      openTickets,
      scheduledWorkOrders,
      monthlyRevenue: Number(monthlyRevenue._sum.adjustmentsTotal ?? 0),
    };
  }
}
