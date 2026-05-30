import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { StockStatus, TransactionType } from '../../../generated/prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOperationalSnapshot(organizationId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todaySalesResult = await this.prisma.db.inventoryTransaction.aggregate({
      where: {
        organizationId,
        type: TransactionType.SALE,
        createdAt: { gte: todayStart },
      },
      _sum: { quantityChange: true },
    });

    const stockCounts = await this.prisma.db.inventoryItem.groupBy({
      by: ['status'],
      where: { organizationId, isActive: true },
      _count: { status: true },
    });

    const totalItems = await this.prisma.db.inventoryItem.count({
      where: { organizationId, isActive: true },
    });

    return {
      todaySales: Number(todaySalesResult._sum.quantityChange ?? 0),
      todayExpenses: 0, // placeholder
      lowStockCount: stockCounts.find(s => s.status === StockStatus.LOW)?._count.status ?? 0,
      criticalStockCount: stockCounts.find(s => s.status === StockStatus.CRITICAL)?._count.status ?? 0,
      outOfStockCount: stockCounts.find(s => s.status === StockStatus.OUT_OF_STOCK)?._count.status ?? 0,
      totalItems,
    };
  }

  async getAttentionFeed(organizationId: string) {
    const criticalItems = await this.prisma.db.inventoryItem.findMany({
      where: {
        organizationId,
        isActive: true,
        status: { in: [StockStatus.CRITICAL, StockStatus.OUT_OF_STOCK] },
      },
      orderBy: { status: 'desc' },
      take: 10,
    });

    const lowItems = await this.prisma.db.inventoryItem.findMany({
      where: {
        organizationId,
        isActive: true,
        status: StockStatus.LOW,
      },
      orderBy: { quantity: 'asc' },
      take: 5,
    });

    const criticalAlerts = criticalItems.map(item => ({
      severity: 'critical',
      title:
        item.status === StockStatus.OUT_OF_STOCK
          ? `${item.name} is out of stock`
          : `${item.name} stock is critical`,
      description:
        item.status === StockStatus.OUT_OF_STOCK
          ? 'This item has zero stock. Restock immediately.'
          : 'Stock level is critically low. Order soon.',
      itemId: item.id,
    }));

    const lowAlerts = lowItems.map(item => ({
      severity: 'warning',
      title: `${item.name} is running low`,
      description: 'Stock is below reorder threshold.',
      itemId: item.id,
    }));

    return [...criticalAlerts, ...lowAlerts];
  }

  async getInventoryHealth(organizationId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentActivity = await this.prisma.db.inventoryTransaction.groupBy({
      by: ['itemId'],
      where: {
        organizationId,
        type: TransactionType.SALE,
        createdAt: { gte: sevenDaysAgo },
      },
      _sum: { quantityChange: true },
      orderBy: { _sum: { quantityChange: 'desc' } },
      take: 5,
    });

    const allItems = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true },
    });

    const fastMovingIds = new Set(recentActivity.map(r => r.itemId));

    const deadStockItems = allItems
      .filter(
        item =>
          !fastMovingIds.has(item.id) &&
          item.status !== StockStatus.OUT_OF_STOCK &&
          Number(item.quantity) > 0,
      )
      .slice(0, 5);

    const healthyCount = allItems.filter(item => item.status === StockStatus.HEALTHY).length;
    const healthScore = allItems.length === 0 ? 100 : Math.round((healthyCount / allItems.length) * 100);

    const fastMoving = recentActivity.map(r => ({
      itemId: r.itemId,
      totalSold: Number(r._sum.quantityChange ?? 0),
    }));

    return { healthScore, fastMoving, deadStock: deadStockItems };
  }
}
