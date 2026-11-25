import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma.service';
import { AnalyticsService } from './analytics.service';
import { VerticalAnalyticsService } from './vertical-analytics.service';
import { IspController } from '../isp/isp.controller';
import {
  buildZeroFilledSeries,
  computePeriodComparison,
  eatDayBounds,
  eatWeekBounds,
  toEatDateKey,
} from './time-buckets';

describe('Data Integrity Reconciliation Suite (Phase B & F)', () => {
  const ORG_A = 'org_integrity_a';
  const ORG_Z = 'org_zero_z';

  describe('Time Bucketing & EAT (Africa/Nairobi) Boundaries (H4)', () => {
    it('places 23:59 EAT and 00:01 EAT (22:00 UTC) on distinct Nairobi calendar days', () => {
      const beforeMidnightEat = new Date('2026-11-24T20:59:00.000Z'); // 2026-11-24 23:59 EAT
      const afterMidnightEat = new Date('2026-11-24T21:01:00.000Z');  // 2026-11-25 00:01 EAT
      const tenPmUtc = new Date('2026-11-24T22:00:00.000Z');          // 2026-11-25 01:00 EAT

      expect(toEatDateKey(beforeMidnightEat)).toBe('2026-11-24');
      expect(toEatDateKey(afterMidnightEat)).toBe('2026-11-25');
      expect(toEatDateKey(tenPmUtc)).toBe('2026-11-25');

      const start = eatDayBounds(-1, new Date('2026-11-25T10:00:00.000Z')).start; // Nov 24 00:00 EAT
      const end = eatDayBounds(1, new Date('2026-11-25T10:00:00.000Z')).start;   // Nov 26 00:00 EAT

      const { buckets, total } = buildZeroFilledSeries(start, end, 'day', [
        { timestamp: beforeMidnightEat, value: 150 },
        { timestamp: afterMidnightEat, value: 200 },
        { timestamp: tenPmUtc, value: 50 },
      ]);

      expect(buckets).toHaveLength(2);
      expect(buckets[0].value).toBe(150);
      expect(buckets[0].count).toBe(1);
      expect(buckets[1].value).toBe(250);
      expect(buckets[1].count).toBe(2);
      expect(total).toBe(400);
      expect(total).toBe(buckets.reduce((s, b) => s + b.value, 0));
    });

    it('computes Monday-start ISO weeks in Africa/Nairobi', () => {
      // Wednesday 2026-11-25 12:00 EAT -> Monday 2026-11-23 00:00+03:00 (2026-11-22T21:00:00Z)
      const wed = new Date('2026-11-25T09:00:00.000Z');
      const { start, end } = eatWeekBounds(0, wed);
      expect(toEatDateKey(start)).toBe('2026-11-23');
      expect(toEatDateKey(new Date(end.getTime() - 1))).toBe('2026-11-29');
    });

    it('never fabricates +100% when previous period has zero activity', () => {
      const cmp = computePeriodComparison(5000, 0, 'vs last week');
      expect(cmp.deltaPct).toBeNull();
      expect(cmp.status).toBe('no_previous_data');
      expect(cmp.previousTotal).toBe(0);
    });
  });

  describe('Org Z: Zero-Sales Week & Honest Empty Series', () => {
    it('returns all-zero buckets with total === 0 and null deltaPct for zero-sales org', async () => {
      const db: any = {
        inventoryTransaction: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
        inventoryItem: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
        alert: { findMany: jest.fn(async () => []) },
        organization: { findUnique: jest.fn(async () => ({ businessType: 'DUKA' })) },
      };
      const service = new AnalyticsService(
        { db } as unknown as PrismaService,
        { get: jest.fn() } as unknown as ConfigService,
        new VerticalAnalyticsService({ db } as unknown as PrismaService),
      );

      const summary = await service.getDashboardSummary(ORG_Z, { preset: '7d' });

      expect(summary.selectedPeriod.salesTotal).toBe(0);
      expect(summary.selectedPeriod.expensesTotal).toBe(0);
      expect(summary.selectedPeriod.profitTotal).toBe(0);
      expect(summary.selectedPeriod.salesComparison.deltaPct).toBeNull();
      expect(summary.selectedPeriod.salesComparison.status).toBe('no_previous_data');
      expect(summary.selectedPeriod.dailyPerformance).toHaveLength(7);
      for (const day of summary.selectedPeriod.dailyPerformance) {
        expect(day.sales).toBe(0);
        expect(day.expenses).toBe(0);
      }

      const metric = await service.getMetricSeries(ORG_Z, { preset: '7d', metric: 'sales.revenue' });
      expect(metric.total).toBe(0);
      expect(metric.buckets).toHaveLength(7);
      expect(metric.buckets.every((b) => b.value === 0)).toBe(true);
      expect(metric.meta.reconciled).toBe(true);
    });
  });

  describe('Retail Tiered Pricing & Metric Reconciliation (H9/H10)', () => {
    it('honors appliedTierPrice in metadata and proves total === sum(buckets)', async () => {
      const now = new Date();
      const txs = [
        {
          organizationId: ORG_A,
          type: 'SALE',
          quantityChange: -10,
          createdAt: now,
          reason: null,
          metadata: { appliedTierPrice: 80 },
          item: { sellingPrice: 100, costPrice: 50, isComposite: false },
        },
        {
          organizationId: ORG_A,
          type: 'PURCHASE',
          quantityChange: 5,
          createdAt: now,
          reason: null,
          metadata: null,
          item: { sellingPrice: 100, costPrice: 40, isComposite: false },
        },
      ];
      const db: any = {
        inventoryTransaction: {
          findMany: jest.fn(async (args: any) =>
            args?.where?.organizationId === ORG_A ? (args?.where?.createdAt?.lt ? [] : txs) : [],
          ),
          groupBy: jest.fn(async () => []),
        },
        inventoryItem: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
        alert: { findMany: jest.fn(async () => []) },
        organization: { findUnique: jest.fn(async () => ({ businessType: 'DUKA' })) },
      };
      const service = new AnalyticsService(
        { db } as unknown as PrismaService,
        { get: jest.fn() } as unknown as ConfigService,
        new VerticalAnalyticsService({ db } as unknown as PrismaService),
      );

      const summary = await service.getDashboardSummary(ORG_A, { preset: '7d' });
      expect(summary.selectedPeriod.salesTotal).toBe(800);
      expect(summary.selectedPeriod.expensesTotal).toBe(200);
      expect(summary.selectedPeriod.profitTotal).toBe(600);
      const bucketSalesSum = summary.selectedPeriod.dailyPerformance.reduce((s, d) => s + d.sales, 0);
      expect(bucketSalesSum).toBe(summary.selectedPeriod.salesTotal);

      // Cross-org isolation: ORG_Z sees 0
      const otherOrg = await service.getDashboardSummary(ORG_Z, { preset: '7d' });
      expect(otherOrg.selectedPeriod.salesTotal).toBe(0);
    });
  });

  describe('Wholesale Credit Non-Truncation (H5)', () => {
    it('sums totalOutstanding across ALL open credits, not just top 5 debtors', async () => {
      const credits = Array.from({ length: 7 }, (_, i) => ({
        id: `c_${i}`,
        clientName: `Client ${i}`,
        amountTotal: 1000 * (i + 1),
        amountPaid: 0,
        status: 'UNPAID',
      }));
      const db: any = {
        inventoryTransaction: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
        creditRecord: { findMany: jest.fn(async () => credits) },
        inventoryItem: { findMany: jest.fn(async () => []), findUnique: jest.fn(async () => null) },
        alert: { findMany: jest.fn(async () => []) },
      };
      const vertical = new VerticalAnalyticsService({ db } as unknown as PrismaService);

      const result = await vertical.getWholesaleDashboard(ORG_A);
      // 1000+2000+3000+4000+5000+6000+7000 = 28000
      expect(result.openCreditCount).toBe(7);
      expect(result.totalOutstanding).toBe(28000);
      expect(result.topDebtors).toHaveLength(5);
    });
  });

  describe('Restaurant Composite & Ingredient Exclusion (H3/H6)', () => {
    it('excludes ingredient deduction rows and sums TableOrder + composite counter sales accurately', async () => {
      const now = new Date();
      const db: any = {
        tableOrder: {
          findMany: jest.fn(async () => [
            {
              id: 'ord_open',
              status: 'OPEN',
              tableLabel: 'T1',
              createdAt: now,
              items: [{ quantity: 1, unitPrice: 500, item: { name: 'Burger', sellingPrice: 500 } }],
            },
            {
              id: 'ord_paid',
              status: 'PAID',
              tableLabel: 'T2',
              createdAt: now,
              closedAt: now,
              items: [{ quantity: 2, unitPrice: 850, item: { name: 'Pizza', sellingPrice: 850 } }],
            },
          ]),
          count: jest.fn(async () => 1),
        },
        inventoryTransaction: {
          findMany: jest.fn(async () => [
            // Ingredient deduction from table order -> MUST be ignored
            {
              quantityChange: -2,
              reason: 'Table order T2 closed',
              createdAt: now,
              metadata: null,
              item: { sellingPrice: 120, isComposite: false },
            },
            // Ingredient deduction from composite counter sale -> MUST be ignored
            {
              quantityChange: -0.5,
              reason: 'Used in 1 x Chicken Platter',
              createdAt: now,
              metadata: null,
              item: { sellingPrice: 300, isComposite: false },
            },
            // Composite counter dish sale parent record
            {
              quantityChange: 0,
              reason: 'Sold composite: deducted 0.5 kg Chicken',
              createdAt: now,
              metadata: { compositeQuantity: 1, unitPrice: 900, amountTotal: 900 },
              item: { sellingPrice: 900, isComposite: true },
            },
          ]),
          groupBy: jest.fn(async () => []),
        },
        inventoryItem: { findUnique: jest.fn(async () => null) },
        alert: { findMany: jest.fn(async () => []) },
      };
      const vertical = new VerticalAnalyticsService({ db } as unknown as PrismaService);

      const res = await vertical.getRestaurantDashboard(ORG_A);
      // 1700 (paid TableOrder) + 900 (composite counter sale) = 2600
      expect(res.todayRevenue).toBe(2600);
      expect(res.openOrdersCount).toBe(1);
      expect(res.openOrdersValue).toBe(500);
      expect(res.dailySeries.revenue.reduce((s, b) => s + b.value, 0)).toBe(2600);
    });
  });

  describe('Guest House Maintenance Exclusion & Occupancy Series', () => {
    it('excludes MAINTENANCE rooms from totalRooms capacity', async () => {
      const db: any = {
        room: {
          findMany: jest.fn(async () => [
            { id: 'r1', status: 'OCCUPIED' },
            { id: 'r2', status: 'VACANT_CLEAN' },
            { id: 'r3', status: 'MAINTENANCE' },
          ]),
        },
        booking: {
          count: jest.fn(async () => 1),
          findMany: jest.fn(async () => []),
        },
        invoice: { findMany: jest.fn(async () => []) },
        payment: { findMany: jest.fn(async () => []) },
        inventoryTransaction: { findMany: jest.fn(async () => []) },
        inventoryItem: { findMany: jest.fn(async () => []) },
      };
      const vertical = new VerticalAnalyticsService({ db } as unknown as PrismaService);

      const res = await vertical.getGuestHouseDashboard(ORG_A);
      expect(res.totalRooms).toBe(2);
      expect(res.occupiedRooms).toBe(1);
      expect(res.occupancyRate).toBe(50);
    });
  });

  describe('ISP Dashboard Payment Reconciliation & Zero Comparison (H9)', () => {
    it('computes monthlyRevenue from recorded ISP payments and returns null deltaPct when prior month is 0', async () => {
      const now = new Date();
      const db: any = {
        subscriber: { count: jest.fn(async () => 2) },
        ticket: { count: jest.fn(async () => 1), findMany: jest.fn(async () => [{ createdAt: now }]) },
        workOrder: { count: jest.fn(async () => 1), findMany: jest.fn(async () => [{ createdAt: now }]) },
        payment: {
          findMany: jest.fn(async () => [
            { amount: 2500, recordedAt: now },
            { amount: 1500, recordedAt: now },
          ]),
        },
      };
      const controller = new IspController({ db } as unknown as PrismaService);

      const res = await controller.getDashboard(ORG_A);
      expect(res.monthlyRevenue).toBe(4000);
      expect(res.revenueComparison.deltaPct).toBeNull();
      expect(res.revenueComparison.status).toBe('no_previous_data');
      expect(res.dailySeries.revenue.reduce((s, b) => s + b.value, 0)).toBe(4000);
    });
  });
});
