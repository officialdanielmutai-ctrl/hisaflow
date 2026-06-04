import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async checkLowStock(organizationId: string) {
    const products = await this.prisma.db.product.findMany({
      where: {
        organizationId,
        isActive: true,
        reorderThreshold: { gt: 0 },
      },
    });

    const lowStock = products.filter(
      (p) => Number(p.quantity) <= Number(p.reorderThreshold),
    );

    for (const p of lowStock) {
      await this.prisma.db.alert.upsert({
        where: {
          organizationId_productId_type: {
            organizationId,
            productId: p.id,
            type: 'LOW_STOCK',
          },
        },
        update: { resolvedAt: null, updatedAt: new Date() },
        create: {
          organizationId,
          productId: p.id,
          type: 'LOW_STOCK',
          message: `${p.name} is low on stock (${p.quantity} ${p.unit} remaining, threshold: ${p.reorderThreshold})`,
          severity: Number(p.quantity) === 0 ? 'CRITICAL' : 'WARNING',
        },
      });
    }

    return { checked: products.length, alerts: lowStock.length };
  }

  async getActiveAlerts(organizationId: string) {
    return this.prisma.db.alert.findMany({
      where: { organizationId, resolvedAt: null },
      include: { product: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
