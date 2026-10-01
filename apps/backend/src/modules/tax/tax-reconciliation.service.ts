import { Injectable, Logger } from '@nestjs/common';
import {
  AlertSeverity,
  AlertStatus,
  AlertType,
  InvoiceStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { EntitlementsService } from '../../core/entitlements/entitlements.service';
import { TierFeature } from '../../core/entitlements/entitlements.constant';
import { NotificationsService } from '../notifications/notifications.service';
import {
  detectTaxAnomalies,
  ExpectedSale,
  FiledInvoiceRecord,
  invoiceIdFromAnomalyKey,
  TaxAnomaly,
} from './tax-reconciliation';
import {
  daysBetween,
  filingDeadlineFor,
  monthPeriod,
  resolvePeriod,
  TaxPeriod,
} from './tax-period';

/** Backwards-compatible alias; the shared period type lives in `tax-period.ts`. */
export type TaxReconciliationPeriod = TaxPeriod;

export interface TaxReconciliationView {
  period: TaxReconciliationPeriod;
  filingDeadline: Date;
  /** Negative means the deadline has passed. */
  daysUntilDeadline: number;
  checkedInvoices: number;
  anomalies: TaxAnomaly[];
  generatedAt: Date;
}

export interface ReconciliationRunResult {
  skipped: boolean;
  anomalies: number;
}

/**
 * Phase E — reconciliation & anomaly detection. Compares the sales that should
 * have been filed with what KRA/`TaxInvoiceRecord` actually holds, and flags
 * mismatches before the VAT filing deadline.
 *
 * Team-tier depth (paywall Section 1A): the tax *floor* (filing, calculation,
 * period summary) stays in Solo, but reconciliation is a Team upsell. The HTTP
 * route enforces this with `@RequiresFeatures(TaxReconciliation)` and the
 * service asserts it too; the scheduled run silently skips non-entitled orgs.
 */
@Injectable()
export class TaxReconciliationService {
  private readonly logger = new Logger(TaxReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Read model for the Team-gated dashboard. */
  async getReport(
    organizationId: string,
    range?: { from?: string; to?: string },
  ): Promise<TaxReconciliationView> {
    await this.entitlements.assertFeatures(organizationId, [
      TierFeature.TaxReconciliation,
    ]);

    const period = resolvePeriod(range);
    const { expectedSales, filedRecords } = await this.load(
      organizationId,
      period,
    );
    const now = new Date();
    const anomalies = detectTaxAnomalies({
      expectedSales,
      filedRecords,
      now,
    });
    const filingDeadline = filingDeadlineFor(period.to);

    return {
      period,
      filingDeadline,
      daysUntilDeadline: daysBetween(now, filingDeadline),
      checkedInvoices: expectedSales.length,
      anomalies,
      generatedAt: now,
    };
  }

  /**
   * One org's reconciliation pass. Entitlement-checked so a Solo org never gets
   * Team-depth alerts it cannot use.
   */
  async runForOrganization(
    organizationId: string,
    now = new Date(),
  ): Promise<ReconciliationRunResult> {
    const entitled = await this.entitlements.hasFeature(
      organizationId,
      TierFeature.TaxReconciliation,
    );
    if (!entitled) {
      return { skipped: true, anomalies: 0 };
    }

    // Reconcile the open filing window, plus any period that still has an
    // unresolved anomaly — so an old mismatch is re-flagged rather than
    // silently dropped once its month scrolls out of the window.
    const periods = await this.periodsToCheck(organizationId, now);
    const byKey = new Map<string, TaxAnomaly>();
    const checkedInvoiceIds = new Set<string>();

    for (const period of periods) {
      const { expectedSales, filedRecords } = await this.load(
        organizationId,
        period,
      );
      for (const sale of expectedSales) checkedInvoiceIds.add(sale.invoiceId);
      for (const record of filedRecords) {
        checkedInvoiceIds.add(record.invoiceId);
      }
      for (const anomaly of detectTaxAnomalies({
        expectedSales,
        filedRecords,
        now,
      })) {
        byKey.set(anomaly.key, anomaly);
      }
    }

    const anomalies = [...byKey.values()];
    await this.flagAnomalies(
      organizationId,
      checkedInvoiceIds,
      anomalies,
      now,
    );

    if (anomalies.length > 0) {
      this.logger.warn(
        `Tax reconciliation flagged ${anomalies.length} anomaly(ies) for org ${organizationId}`,
      );
    }

    return { skipped: false, anomalies: anomalies.length };
  }

  /**
   * Open window (current + previous month) plus any period an existing
   * unresolved alert belongs to, so carry-forward issues keep being checked.
   */
  private async periodsToCheck(
    organizationId: string,
    now: Date,
  ): Promise<TaxPeriod[]> {
    const periods = [monthPeriod(now, -1), monthPeriod(now, 0)];

    const unresolved = await this.prisma.db.alert.findMany({
      where: {
        organizationId,
        type: AlertType.TAX_RECONCILIATION_MISMATCH,
        status: AlertStatus.UNRESOLVED,
      },
      select: { itemId: true },
    });
    const invoiceIds = unresolved
      .map((alert) => invoiceIdFromAnomalyKey(alert.itemId))
      .filter((id): id is string => Boolean(id));

    if (invoiceIds.length > 0) {
      const invoices = await this.prisma.db.invoice.findMany({
        where: { id: { in: invoiceIds } },
        select: { issuedAt: true, createdAt: true },
      });
      for (const invoice of invoices) {
        periods.push(monthPeriod(invoice.issuedAt ?? invoice.createdAt, 0));
      }
    }

    const seen = new Set<number>();
    return periods.filter((period) => {
      const key = period.from.getTime();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /** Scheduled entry point. */
  async runAll(
    now = new Date(),
  ): Promise<{ checked: number; flagged: number }> {
    const registrations = await this.prisma.db.taxRegistration.findMany({
      select: { organizationId: true },
    });

    let flagged = 0;
    for (const registration of registrations) {
      try {
        const result = await this.runForOrganization(
          registration.organizationId,
          now,
        );
        flagged += result.anomalies;
      } catch (err) {
        this.logger.error(
          `Tax reconciliation failed for org ${registration.organizationId}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }

    return { checked: registrations.length, flagged };
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async load(
    organizationId: string,
    period: TaxReconciliationPeriod,
  ): Promise<{
    expectedSales: ExpectedSale[];
    filedRecords: FiledInvoiceRecord[];
  }> {
    const [invoices, records] = await Promise.all([
      this.prisma.db.invoice.findMany({
        where: {
          organizationId,
          status: {
            in: [
              InvoiceStatus.ISSUED,
              InvoiceStatus.PARTIAL,
              InvoiceStatus.PAID,
            ],
          },
          taxTotal: { gt: 0 },
          OR: [
            { issuedAt: { gte: period.from, lt: period.to } },
            {
              issuedAt: null,
              createdAt: { gte: period.from, lt: period.to },
            },
          ],
        },
        select: { id: true, status: true, taxTotal: true },
      }),
      this.prisma.db.taxInvoiceRecord.findMany({
        where: {
          organizationId,
          createdAt: { gte: period.from, lt: period.to },
        },
        select: {
          invoiceId: true,
          status: true,
          taxAmount: true,
          createdAt: true,
          invoice: { select: { status: true } },
        },
      }),
    ]);

    return {
      expectedSales: invoices.map((invoice) => ({
        invoiceId: invoice.id,
        invoiceStatus: invoice.status,
        taxTotal: Number(invoice.taxTotal),
      })),
      filedRecords: records.map((record) => ({
        invoiceId: record.invoiceId,
        status: record.status,
        taxAmount: Number(record.taxAmount),
        invoiceStatus: record.invoice.status,
        createdAt: record.createdAt,
      })),
    };
  }

  /**
   * Keep the alert set in sync with reality — but only resolve alerts whose
   * invoice this run actually re-checked, so an alert for an unexamined period
   * is never silently cleared.
   */
  private async flagAnomalies(
    organizationId: string,
    checkedInvoiceIds: Set<string>,
    anomalies: TaxAnomaly[],
    now: Date,
  ): Promise<void> {
    const currentKeys = new Set(anomalies.map((anomaly) => anomaly.key));

    const unresolved = await this.prisma.db.alert.findMany({
      where: {
        organizationId,
        type: AlertType.TAX_RECONCILIATION_MISMATCH,
        status: AlertStatus.UNRESOLVED,
      },
      select: { id: true, itemId: true },
    });
    const toResolve = unresolved
      .filter((alert) => {
        const invoiceId = invoiceIdFromAnomalyKey(alert.itemId);
        return (
          invoiceId !== null &&
          checkedInvoiceIds.has(invoiceId) &&
          (!alert.itemId || !currentKeys.has(alert.itemId))
        );
      })
      .map((alert) => alert.id);

    if (toResolve.length > 0) {
      await this.prisma.db.alert.updateMany({
        where: { id: { in: toResolve } },
        data: { status: AlertStatus.RESOLVED, resolvedAt: now },
      });
    }

    if (anomalies.length === 0) return;

    const existing = await this.prisma.db.alert.findMany({
      where: {
        organizationId,
        type: AlertType.TAX_RECONCILIATION_MISMATCH,
        status: AlertStatus.UNRESOLVED,
        itemId: { in: [...currentKeys] },
      },
      select: { itemId: true },
    });
    const knownKeys = new Set(existing.map((alert) => alert.itemId));

    let createdCritical = false;
    for (const anomaly of anomalies) {
      if (knownKeys.has(anomaly.key)) continue;
      const critical = anomaly.severity === 'critical';
      await this.prisma.db.alert.create({
        data: {
          organizationId,
          itemId: anomaly.key,
          type: AlertType.TAX_RECONCILIATION_MISMATCH,
          severity: critical ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          title: 'Tax reconciliation anomaly',
          description: anomaly.message,
        },
      });
      if (critical) createdCritical = true;
    }

    if (createdCritical) {
      await this.notifications
        .sendPushToOrganization(organizationId, {
          title: 'Tax reconciliation anomaly',
          body: 'A tax filing mismatch needs attention before the deadline.',
          url: '/tax/reconciliation',
        })
        .catch(() => undefined);
    }
  }
}

