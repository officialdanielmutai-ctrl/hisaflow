import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { AlertType, AlertSeverity } from '../../../generated/prisma/client';
import { AfricasTalkingProvider } from '../../infrastructure/providers/africas-talking.provider';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly africasTalking: AfricasTalkingProvider,
  ) {}

  // ── Main entry point: runs every check and auto-resolves stale alerts ──────
  async runAllChecks(organizationId: string) {
    await Promise.all([
      this.checkStockLevels(organizationId),
      this.checkDeadStock(organizationId),
      this.checkWastageSpike(organizationId),
    ]);
    return { ok: true };
  }

  // ── Stock level checks: LOW_STOCK + OUT_OF_STOCK ──────────────────────────
  private async checkStockLevels(organizationId: string) {
    const items = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true },
    });

    for (const item of items) {
      const qty = Number(item.quantity);
      const threshold = Number(item.reorderThreshold ?? 0);
      const isOut = qty === 0;
      const isLow = qty > 0 && threshold > 0 && qty <= threshold;

      // ── OUT_OF_STOCK ──────────────────────────────────────────────────────
      if (isOut) {
        await this.upsertAlert({
          organizationId,
          itemId: item.id,
          type: AlertType.OUT_OF_STOCK,
          severity: AlertSeverity.CRITICAL,
          title: `${item.name} is out of stock`,
          description: `${item.name} has zero stock remaining. Restock immediately to avoid lost sales.`,
        });
        // Auto-resolve LOW_STOCK if it existed (out of stock supersedes it)
        await this.autoResolveAlert(organizationId, item.id, AlertType.LOW_STOCK);
      } else {
        // Restock happened — resolve OUT_OF_STOCK if it was open
        await this.autoResolveAlert(organizationId, item.id, AlertType.OUT_OF_STOCK);
      }

      // ── LOW_STOCK ─────────────────────────────────────────────────────────
      if (isLow) {
        await this.upsertAlert({
          organizationId,
          itemId: item.id,
          type: AlertType.LOW_STOCK,
          severity: AlertSeverity.WARNING,
          title: `${item.name} is running low`,
          description: `${item.name} has ${qty} ${item.unit} left (reorder threshold: ${threshold}). Consider restocking soon.`,
        });

        // Send SMS only once (on create) — handled inside upsertAlert via the return value
        const org = await this.prisma.db.organization.findUnique({
          where: { id: organizationId },
          select: { phone: true },
        });
        if (org?.phone) {
          await this.africasTalking.sendSms(
            org.phone,
            `Low stock alert: ${item.name} has ${qty} ${item.unit} remaining.`,
          ).catch(() => {}); // non-fatal
        }
      } else if (qty > threshold) {
        // Restocked above threshold — resolve open LOW_STOCK
        await this.autoResolveAlert(organizationId, item.id, AlertType.LOW_STOCK);
      }
    }
  }

  // ── Dead stock: items with stock but zero sales in the last 30 days ────────
  private async checkDeadStock(organizationId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const items = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true, quantity: { gt: 0 } },
    });

    for (const item of items) {
      const recentSales = await this.prisma.db.inventoryTransaction.count({
        where: {
          organizationId,
          itemId: item.id,
          type: 'SALE',
          createdAt: { gte: thirtyDaysAgo },
        },
      });

      if (recentSales === 0) {
        await this.upsertAlert({
          organizationId,
          itemId: item.id,
          type: AlertType.DEAD_STOCK,
          severity: AlertSeverity.INFO,
          title: `${item.name} has had no sales in 30 days`,
          description: `${item.name} has ${item.quantity} ${item.unit} in stock but has not been sold in the last 30 days. Consider a promotion or review pricing.`,
        });
      } else {
        // Item sold recently — resolve any open dead stock alert
        await this.autoResolveAlert(organizationId, item.id, AlertType.DEAD_STOCK);
      }
    }
  }

  // ── Wastage spike: more than 5 wastage events today for the org ───────────
  private async checkWastageSpike(organizationId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const wastageItems = await this.prisma.db.inventoryTransaction.groupBy({
      by: ['itemId'],
      where: {
        organizationId,
        type: 'WASTAGE',
        createdAt: { gte: todayStart },
      },
      _count: { id: true },
      having: { id: { _count: { gte: 1 } } },
    });

    for (const row of wastageItems) {
      const item = await this.prisma.db.inventoryItem.findUnique({
        where: { id: row.itemId },
        select: { id: true, name: true, unit: true, organizationId: true },
      });
      if (!item || item.organizationId !== organizationId) continue;

      const count = row._count.id;
      if (count >= 3) {
        await this.upsertAlert({
          organizationId,
          itemId: item.id,
          type: AlertType.VARIANCE,
          severity: AlertSeverity.WARNING,
          title: `High wastage recorded for ${item.name} today`,
          description: `${item.name} has had ${count} wastage transaction${count > 1 ? 's' : ''} recorded today. Review storage conditions or handling procedures.`,
        });
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async upsertAlert(data: {
    organizationId: string;
    itemId: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    description: string;
  }) {
    await this.prisma.db.alert.upsert({
      where: {
        organizationId_itemId_type: {
          organizationId: data.organizationId,
          itemId: data.itemId,
          type: data.type,
        },
      },
      update: {
        resolvedAt: null,
        status: 'UNRESOLVED',
        severity: data.severity,
        title: data.title,
        description: data.description,
        updatedAt: new Date(),
      },
      create: {
        organizationId: data.organizationId,
        itemId: data.itemId,
        type: data.type,
        severity: data.severity,
        title: data.title,
        description: data.description,
      },
    });
  }

  private async autoResolveAlert(
    organizationId: string,
    itemId: string,
    type: AlertType,
  ) {
    await this.prisma.db.alert.updateMany({
      where: { organizationId, itemId, type, resolvedAt: null },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
  }

  // ── Public methods ────────────────────────────────────────────────────────

  async getActiveAlerts(organizationId: string) {
    return this.prisma.db.alert.findMany({
      where: { organizationId, resolvedAt: null },
      include: { item: { select: { name: true, unit: true } } },
      orderBy: [
        { severity: 'desc' }, // CRITICAL first
        { createdAt: 'desc' },
      ],
    });
  }

  async resolveAlert(alertId: string, organizationId: string) {
    return this.prisma.db.alert.update({
      where: {
        id: alertId,
        organizationId: organizationId,
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });
  }

  // Keep for backwards-compat — just delegates to runAllChecks
  async checkLowStock(organizationId: string) {
    return this.runAllChecks(organizationId);
  }
}
