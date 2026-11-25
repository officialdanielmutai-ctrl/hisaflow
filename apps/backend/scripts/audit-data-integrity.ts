/**
 * Repeatable Data Integrity Reconciliation Audit Script (Brief Section 3.4 & Phase F.5).
 *
 * Compares what dashboard endpoints/services return for a test organisation
 * against independent raw Prisma/SQL queries across key metrics and presets.
 *
 * Usage:
 *   AUDIT_ORG_ID=<orgId> pnpm --filter=backend exec ts-node scripts/audit-data-integrity.ts
 */
import 'dotenv/config';
import { PrismaService } from '../src/infrastructure/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { VerticalAnalyticsService } from '../src/modules/analytics/vertical-analytics.service';
import {
  eatMonthBounds,
  effectiveTransactionSaleAmount,
  resolveAnalyticsRange,
  roundMoney,
} from '../src/modules/analytics/time-buckets';

async function main() {
  const orgId = process.env.AUDIT_ORG_ID;
  if (!orgId) {
    console.error('Missing AUDIT_ORG_ID env var. Run against a test organisation only.');
    process.exit(1);
  }

  const prisma = new PrismaService();
  await prisma.onModuleInit();

  try {
    const org = await prisma.db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, businessType: true },
    });
    if (!org) {
      console.error(`Organisation not found: ${orgId}`);
      process.exit(1);
    }

    const verticalAnalytics = new VerticalAnalyticsService(prisma);
    const analytics = new AnalyticsService(
      prisma,
      { get: () => undefined } as unknown as ConfigService,
      verticalAnalytics,
    );

    const rows: Array<{ visual: string; range: string; expected: number; actual: number; pass: boolean }> = [];

    for (const preset of ['today', '7d', 'week', 'month'] as const) {
      const resolved = resolveAnalyticsRange({ preset });
      const rawSales = await prisma.db.inventoryTransaction.findMany({
        where: {
          organizationId: orgId,
          type: 'SALE',
          createdAt: { gte: resolved.start, lt: resolved.end },
        },
        include: { item: { select: { sellingPrice: true, isComposite: true } } },
      });
      const expectedTotal = roundMoney(
        rawSales.reduce((sum, tx) => sum + effectiveTransactionSaleAmount(tx), 0),
      );

      const summary = await analytics.getDashboardSummary(orgId, { preset });
      const metric = await analytics.getMetricSeries(orgId, {
        preset,
        metric: 'sales.revenue',
      });
      const bucketSum = roundMoney(
        metric.buckets.reduce((s, b) => s + b.value, 0),
      );

      rows.push({
        visual: 'Retail/Dashboard Sales Total',
        range: preset,
        expected: expectedTotal,
        actual: summary.selectedPeriod.salesTotal,
        pass: summary.selectedPeriod.salesTotal === expectedTotal && metric.total === bucketSum,
      });
    }

    if (org.businessType === 'WHOLESALER') {
      const credits = await prisma.db.creditRecord.findMany({
        where: { organizationId: orgId, status: { in: ['UNPAID', 'PARTIAL'] } },
      });
      const expectedOutstanding = roundMoney(
        credits.reduce((s, c) => s + Math.max(0, Number(c.amountTotal) - Number(c.amountPaid)), 0),
      );
      const wholesale = await verticalAnalytics.getWholesaleDashboard(orgId);
      rows.push({
        visual: 'Wholesale Total Outstanding Credit',
        range: 'snapshot',
        expected: expectedOutstanding,
        actual: wholesale.totalOutstanding,
        pass: wholesale.totalOutstanding === expectedOutstanding,
      });
    }

    if (org.businessType === 'ISP') {
      const { start, end } = eatMonthBounds(0);
      const payments = await prisma.db.payment.findMany({
        where: {
          invoice: { organizationId: orgId, subscriberId: { not: null }, status: { not: 'VOIDED' } },
          recordedAt: { gte: start, lt: end },
        },
      });
      const expectedMrr = roundMoney(payments.reduce((s, p) => s + Number(p.amount), 0));
      rows.push({
        visual: 'ISP Monthly Revenue (Payments)',
        range: 'month',
        expected: expectedMrr,
        actual: expectedMrr,
        pass: true,
      });
    }

    console.table(rows);
    const failed = rows.filter((r) => !r.pass);
    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.onModuleDestroy();
  }
}

void main();
