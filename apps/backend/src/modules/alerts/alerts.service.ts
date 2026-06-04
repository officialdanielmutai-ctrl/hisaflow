import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { AlertType, AlertSeverity } from '../../../generated/prisma/client';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async checkLowStock(organizationId: string) {
    const items = await this.prisma.db.inventoryItem.findMany({
      where: {
        organizationId,
        isActive: true,
        reorderThreshold: { not: null },
      },
    });

    const lowStock = items.filter(
      (item) => Number(item.quantity) <= Number(item.reorderThreshold),
    );

    for (const item of lowStock) {
      const isOut = Number(item.quantity) === 0;
      await this.prisma.db.alert.upsert({
        where: {
          organizationId_itemId_type: {
            organizationId,
            itemId: item.id,
            type: AlertType.LOW_STOCK,
          },
        },
        update: { resolvedAt: null, updatedAt: new Date() },
        create: {
          organizationId,
          itemId: item.id,
          type: AlertType.LOW_STOCK,
          severity: isOut ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          title: isOut
            ? `${item.name} is out of stock`
            : `${item.name} is running low`,
          description: isOut
            ? `${item.name} has zero stock. Restock immediately.`
            : `${item.name} has ${item.quantity} ${item.unit} remaining (threshold: ${item.reorderThreshold}).`,
        },
      });
    }

    return { checked: items.length, alerts: lowStock.length };
  }

  async getActiveAlerts(organizationId: string) {
    return this.prisma.db.alert.findMany({
      where: { organizationId, resolvedAt: null },
      include: { item: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}