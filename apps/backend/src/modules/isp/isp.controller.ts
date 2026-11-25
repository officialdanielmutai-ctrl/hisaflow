import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from '../../core/guards/clerk-auth.guard';
import { OrgContext } from '../../core/decorators/org-context.decorator';
import { PrismaService } from '../../infrastructure/prisma.service';
import { SubscriberStatus, WorkOrderStatus, TicketStatus } from '@prisma/client';
import {
  buildZeroFilledSeries,
  computePeriodComparison,
  eatMonthBounds,
  resolveAnalyticsRange,
  roundMoney,
} from '../analytics/time-buckets';

@UseGuards(ClerkAuthGuard)
@Controller('isp')
export class IspController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('dashboard')
  async getDashboard(@OrgContext() organizationId: string) {
    const now = new Date();
    const { start: startOfMonth, end: endOfMonth } = eatMonthBounds(0, now);
    const { start: prevMonthStart, end: prevMonthEnd } = eatMonthBounds(-1, now);
    const sevenDayWindow = resolveAnalyticsRange({ preset: '7d' }, now);
    const earliestPaymentStart = new Date(
      Math.min(prevMonthStart.getTime(), sevenDayWindow.start.getTime()),
    );

    const [
      totalSubscribers,
      activeSubscribers,
      suspendedSubscribers,
      churnedSubscribers,
      openTickets,
      scheduledWorkOrders,
      payments,
      recentTickets,
      recentWorkOrders,
    ] = await Promise.all([
      this.prisma.db.subscriber.count({ where: { organizationId } }),
      this.prisma.db.subscriber.count({
        where: { organizationId, status: SubscriberStatus.ACTIVE },
      }),
      this.prisma.db.subscriber.count({
        where: { organizationId, status: SubscriberStatus.SUSPENDED },
      }),
      this.prisma.db.subscriber.count({
        where: { organizationId, status: SubscriberStatus.CHURNED },
      }),
      this.prisma.db.ticket.count({
        where: { organizationId, status: TicketStatus.OPEN },
      }),
      this.prisma.db.workOrder.count({
        where: { organizationId, status: WorkOrderStatus.SCHEDULED },
      }),
      this.prisma.db.payment.findMany({
        where: {
          invoice: {
            organizationId,
            subscriberId: { not: null },
            status: { not: 'VOIDED' },
          },
          recordedAt: { gte: earliestPaymentStart, lt: endOfMonth },
        },
        select: { amount: true, recordedAt: true },
      }),
      this.prisma.db.ticket.findMany({
        where: {
          organizationId,
          createdAt: { gte: sevenDayWindow.start, lt: sevenDayWindow.end },
        },
        select: { createdAt: true },
      }),
      this.prisma.db.workOrder.findMany({
        where: {
          organizationId,
          createdAt: { gte: sevenDayWindow.start, lt: sevenDayWindow.end },
        },
        select: { createdAt: true },
      }),
    ]);

    const monthlyRevenue = roundMoney(
      payments
        .filter((p) => p.recordedAt >= startOfMonth && p.recordedAt < endOfMonth)
        .reduce((sum, p) => sum + Number(p.amount), 0),
    );
    const previousMonthRevenue = roundMoney(
      payments
        .filter((p) => p.recordedAt >= prevMonthStart && p.recordedAt < prevMonthEnd)
        .reduce((sum, p) => sum + Number(p.amount), 0),
    );

    const sevenDayRevenue = buildZeroFilledSeries(
      sevenDayWindow.start,
      sevenDayWindow.end,
      'day',
      payments.map((p) => ({ timestamp: new Date(p.recordedAt), value: Number(p.amount) })),
    ).buckets;

    const sevenDayTickets = buildZeroFilledSeries(
      sevenDayWindow.start,
      sevenDayWindow.end,
      'day',
      recentTickets.map((t) => ({ timestamp: new Date(t.createdAt), value: 1 })),
    ).buckets;

    const sevenDayWorkOrders = buildZeroFilledSeries(
      sevenDayWindow.start,
      sevenDayWindow.end,
      'day',
      recentWorkOrders.map((w) => ({ timestamp: new Date(w.createdAt), value: 1 })),
    ).buckets;

    const activeRate =
      totalSubscribers > 0 ? Math.round((activeSubscribers / totalSubscribers) * 100) : 0;

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
      monthlyRevenue,
      revenueComparison: computePeriodComparison(
        monthlyRevenue,
        previousMonthRevenue,
        'vs last month',
      ),
      dailySeries: {
        revenue: sevenDayRevenue,
        tickets: sevenDayTickets,
        workOrders: sevenDayWorkOrders,
      },
      generatedAt: now.toISOString(),
    };
  }
}
