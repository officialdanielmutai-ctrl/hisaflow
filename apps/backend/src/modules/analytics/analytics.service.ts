import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummary(organizationId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [todayTransactions, allProducts, activeAlerts] = await Promise.all([
      this.prisma.db.stockTransaction.findMany({
        where: {
          organizationId,
          createdAt: { gte: todayStart },
        },
        include: {
          product: {
            select: {
              sellingPrice: true,
              costPrice: true,
            },
          },
        },
      }),
      this.prisma.db.product.findMany({
        where: { organizationId, isActive: true },
      }),
      this.prisma.db.alert.findMany({
        where: { organizationId, resolvedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);

    // KPI calculations
    let todaySales = 0;
    let todayExpenses = 0;

    for (const tx of todayTransactions) {
      const qty = Math.abs(Number(tx.quantityChange));
      if (tx.type === 'SALE' && tx.product.sellingPrice != null) {
        todaySales += qty * Number(tx.product.sellingPrice);
      } else if (tx.type === 'PURCHASE' && tx.product.costPrice != null) {
        todayExpenses += qty * Number(tx.product.costPrice);
      }
    }

    const lowStockCount = allProducts.filter(
      (p) => Number(p.quantity) <= Number(p.reorderThreshold) && Number(p.reorderThreshold) > 0
    ).length;

    const profitEstimate = todaySales - todayExpenses;

    // Inventory snapshot
    const total = allProducts.length;
    const healthy = allProducts.filter((p) => Number(p.quantity) > Number(p.reorderThreshold) * 1.5).length;
    const low = allProducts.filter(
      (p) => Number(p.quantity) <= Number(p.reorderThreshold) && Number(p.quantity) > 0
    ).length;
    const outOfStock = allProducts.filter((p) => Number(p.quantity) === 0).length;
    const stockHealthPct = total === 0 ? 0 : Math.round((healthy / total) * 100);

    const hour = now.getHours();
    let timeOfDay: 'morning' | 'afternoon' | 'evening';
    if (hour >= 0 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
    else timeOfDay = 'evening';

    return {
      greeting: { timeOfDay },
      kpis: {
        todaySales,
        todayExpenses,
        lowStockCount,
        profitEstimate,
      },
      attentionFeed: activeAlerts.map((a) => ({
        id: a.id,
        message: a.message,
        severity: a.severity,
        type: a.type,
      })),
      inventorySnapshot: {
        total,
        healthy,
        low,
        outOfStock,
        stockHealthPct,
      },
    };
  }
}
