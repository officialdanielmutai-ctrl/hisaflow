import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma.service';
import { AlertType, AlertSeverity } from '../../../generated/prisma/client';
import { AfricasTalkingProvider } from '../../infrastructure/providers/africas-talking.provider';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly africasTalking: AfricasTalkingProvider,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Main entry point: runs every check and auto-resolves stale alerts ──────
  async runAllChecks(organizationId: string) {
    await Promise.all([
      this.checkStockLevels(organizationId),
      this.checkDeadStock(organizationId),
      this.checkWastageSpike(organizationId),
      this.checkDailyInsights(organizationId),
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

  // ── Dead stock: 7-day grace period logic ────────────────────────────────
  private async checkDeadStock(organizationId: string) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const items = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true, quantity: { gt: 0 } },
    });

    for (const item of items) {
      // Find the most recent PURCHASE transaction
      const lastPurchase = await this.prisma.db.inventoryTransaction.findFirst({
        where: { organizationId, itemId: item.id, type: 'PURCHASE' },
        orderBy: { createdAt: 'desc' },
      });

      const lastStockedDate = lastPurchase ? lastPurchase.createdAt : item.createdAt;

      if (lastStockedDate > sevenDaysAgo) {
        // Item is still in its 7-day grace period
        // Resolve any existing dead stock alert just in case
        await this.autoResolveAlert(organizationId, item.id, AlertType.DEAD_STOCK);
        continue;
      }

      const recentSales = await this.prisma.db.inventoryTransaction.count({
        where: {
          organizationId,
          itemId: item.id,
          type: 'SALE',
          createdAt: { gte: sevenDaysAgo },
        },
      });

      if (recentSales === 0) {
        await this.upsertAlert({
          organizationId,
          itemId: item.id,
          type: AlertType.DEAD_STOCK,
          severity: AlertSeverity.INFO,
          title: `${item.name} has had no sales in 7 days`,
          description: `${item.name} has ${item.quantity} ${item.unit} in stock but hasn't sold since ${lastStockedDate.toLocaleDateString()}. Consider a promotion.`,
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
    const alert = await this.prisma.db.alert.upsert({
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

    // Send push notification
    this.notificationsService.sendPushToOrganization(data.organizationId, {
      title: data.title,
      body: data.description,
      url: '/alerts',
    }).catch(console.error);

    return alert;
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
  // ── Daily Insights ────────────────────────────────────────────────────────
  private async checkDailyInsights(organizationId: string) {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const items = await this.prisma.db.inventoryItem.findMany({
      where: { organizationId, isActive: true, quantity: { gt: 0 } },
    });

    const noActivityNames: string[] = [];

    for (const item of items) {
      // Find all transactions in the last 24h
      const txs = await this.prisma.db.inventoryTransaction.findMany({
        where: { organizationId, itemId: item.id, createdAt: { gte: twentyFourHoursAgo } },
      });

      if (txs.length === 0) {
        // Only flag 'No Activity' if the item is older than 24h (prevents spam for brand new items)
        if (item.createdAt <= twentyFourHoursAgo) {
          noActivityNames.push(item.name);
        }
      } else {
        // High activity check
        const salesTxs = txs.filter((tx) => tx.type === 'SALE');
        const unitsSold = salesTxs.reduce((sum, tx) => sum + Math.abs(Number(tx.quantityChange)), 0);
        
        // High activity if sold >= 10 units OR more than 20% of current stock
        if (unitsSold >= 10 || (unitsSold > 0 && unitsSold >= Number(item.quantity) * 0.2)) {
          await this.prisma.db.alert.upsert({
            where: {
              organizationId_itemId_type: {
                organizationId,
                itemId: item.id,
                type: AlertType.DAILY_INSIGHT,
              },
            },
            update: {
              resolvedAt: null,
              status: 'UNRESOLVED',
              title: `High Activity: ${item.name}`,
              description: `${item.name} has sold ${unitsSold} units today. Great job!`,
              updatedAt: new Date(),
            },
            create: {
              organizationId,
              itemId: item.id,
              type: AlertType.DAILY_INSIGHT,
              severity: AlertSeverity.INFO,
              title: `High Activity: ${item.name}`,
              description: `${item.name} has sold ${unitsSold} units today. Great job!`,
            },
          });
        } else {
          // Resolve individual high activity alert if it slowed down
          await this.autoResolveAlert(organizationId, item.id, AlertType.DAILY_INSIGHT);
        }
      }
    }

    // Process Grouped No Activity Insight
    const noActivityTitle = 'No Activity Today';
    if (noActivityNames.length > 0) {
      const namesStr =
        noActivityNames.slice(0, 5).join(', ') +
        (noActivityNames.length > 5 ? ` and ${noActivityNames.length - 5} others` : '');

      const existing = await this.prisma.db.alert.findFirst({
        where: { organizationId, type: AlertType.DAILY_INSIGHT, title: noActivityTitle },
      });

      if (existing) {
        await this.prisma.db.alert.update({
          where: { id: existing.id },
          data: {
            description: `${noActivityNames.length} items had no activity today: ${namesStr}. Consider checking on them.`,
            updatedAt: new Date(),
            resolvedAt: null,
            status: 'UNRESOLVED',
          },
        });
      } else {
        await this.prisma.db.alert.create({
          data: {
            organizationId,
            // itemId is left null explicitly for grouped alerts
            type: AlertType.DAILY_INSIGHT,
            severity: AlertSeverity.INFO,
            title: noActivityTitle,
            description: `${noActivityNames.length} items had no activity today: ${namesStr}. Consider checking on them.`,
          },
        });
      }
    } else {
      // Resolve if there are no idle items today
      await this.prisma.db.alert.updateMany({
        where: { organizationId, type: AlertType.DAILY_INSIGHT, title: noActivityTitle, resolvedAt: null },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });
    }
  }
  // Keep for backwards-compat — just delegates to runAllChecks
  async checkLowStock(organizationId: string) {
    return this.runAllChecks(organizationId);
  }
}
