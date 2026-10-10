import { describe, it, expect } from 'vitest';
import type { StatCardConfig } from '@/components/system/StatCard';
import type {
  ChemistDashboardData,
  DashboardData,
  GuestHouseDashboardData,
  RestaurantDashboardData,
  SchoolDashboardData,
  StaffDashboardData,
  WholesaleDashboardData,
} from '@/services/analytics.service';
import type { IspDashboardData } from '@/services/isp.service';

import { ISP_KPI_ROWS } from './isp';
import { CHEMIST_KPI_ROWS } from './chemist';
import { RESTAURANT_KPI_ROWS } from './restaurant';
import { SCHOOL_KPI_ROWS } from './school';
import { WHOLESALE_KPI_ROWS } from './wholesale';
import { GUEST_HOUSE_KPI_ROWS } from './guest-house';
import { RETAIL_KPI_ROWS, RETAIL_INVENTORY_ROWS } from './retail';
import { STAFF_KPI_ROWS } from './staff';

/**
 * Arrangement regression guard (overhaul Duty 1, Section 2.5).
 *
 * The shared `StatCard` is covered by its own unit/geometry tests. These tests
 * protect each vertical's *arrangement*: the metric set, order, and the exact
 * data each card pulls, so a refactor cannot silently drop a metric or change a
 * number's source. Visual drift is guarded separately by
 * `e2e/tests/dashboard-layout.spec.ts`.
 */

function idsOf<T>(rows: StatCardConfig<T>[][]): string[] {
  return rows.flat().map((card) => card.id);
}

function contentOf<T>(
  rows: StatCardConfig<T>[][],
  data: T,
): Map<string, ReturnType<StatCardConfig<T>['build']>> {
  return new Map(rows.flat().map((card) => [card.id, card.build(data)]));
}

/** Structural view for cross-vertical checks; no data/behaviour involved. */
type CardShell = Pick<StatCardConfig<never>, 'id' | 'label' | 'icon' | 'span'>;

function shellsOf<T>(rows: StatCardConfig<T>[][]): CardShell[] {
  return rows.flat().map((card) => ({
    id: card.id,
    label: card.label,
    icon: card.icon,
    span: card.span,
  }));
}

describe('per-vertical KPI arrangements', () => {
  it('ISP keeps its metric set and order', () => {
    expect(idsOf(ISP_KPI_ROWS)).toEqual([
      'monthly-revenue',
      'active-subscribers',
      'work-orders',
      'support-queue',
    ]);
  });

  it('chemist keeps its metrics and value sources', () => {
    const data: ChemistDashboardData = {
      timeOfDay: 'morning',
      todaySales: 12_500,
      monthSales: 340_000,
      lowStockCount: 2,
      totalItems: 48,
      expiringBatches: [],
      expiredBatches: [],
      topSellers: [],
      alerts: [],
    };
    expect(idsOf(CHEMIST_KPI_ROWS)).toEqual([
      'today-sales',
      'month-sales',
      'low-stock',
      'products',
    ]);
    const content = contentOf(CHEMIST_KPI_ROWS, data);
    expect(content.get('today-sales')?.value).toBe('KES 12,500');
    expect(content.get('month-sales')?.value).toBe('KES 340,000');
    expect(content.get('low-stock')?.footnote).toBe('Needs restocking');
    expect(content.get('low-stock')?.footnoteTone).toBe('critical');
    expect(content.get('products')?.value).toBe('48');
  });

  it('restaurant keeps its metrics and value sources', () => {
    const data: RestaurantDashboardData = {
      timeOfDay: 'evening',
      todayRevenue: 48_000,
      openOrdersCount: 3,
      openOrdersValue: 12_000,
      paidOrdersToday: 9,
      openOrders: [],
      topMenuItems: [],
      alerts: [],
    };
    expect(idsOf(RESTAURANT_KPI_ROWS)).toEqual([
      'today-revenue',
      'open-tables',
      'closed-today',
      'pending-value',
    ]);
    const content = contentOf(RESTAURANT_KPI_ROWS, data);
    expect(content.get('today-revenue')?.value).toBe('KES 48,000');
    expect(content.get('open-tables')?.value).toBe('3');
    expect(content.get('open-tables')?.footnote).toBe('KES 12,000 pending');
    expect(content.get('closed-today')?.value).toBe('9');
  });

  it('school keeps its metrics and value sources', () => {
    const data: SchoolDashboardData = {
      timeOfDay: 'morning',
      totalStudents: 240,
      totalClasses: 8,
      activeTerm: { name: 'Term 1', dueDate: null },
      fees: {
        totalExpected: 1_200_000,
        totalCollected: 900_000,
        outstanding: 300_000,
        collectionRate: 75,
        paidCount: 180,
        totalInvoices: 240,
      },
      overdueInvoices: [],
      recentPayments: [],
    };
    expect(idsOf(SCHOOL_KPI_ROWS)).toEqual([
      'total-students',
      'active-classes',
      'fees-collected',
      'outstanding',
    ]);
    const content = contentOf(SCHOOL_KPI_ROWS, data);
    expect(content.get('total-students')?.value).toBe('240');
    expect(content.get('fees-collected')?.value).toBe('KES 900,000');
    expect(content.get('outstanding')?.value).toBe('KES 300,000');
    expect(content.get('outstanding')?.footnote).toBe('25% unpaid');
  });

  it('wholesale keeps its metrics and compacts long values', () => {
    const data: WholesaleDashboardData = {
      timeOfDay: 'afternoon',
      todaySales: 88_000,
      monthSales: 2_400_000,
      totalOutstanding: 150_000,
      openCreditCount: 4,
      lowStockCount: 0,
      totalItems: 300,
      topDebtors: [],
      topSellers: [],
      alerts: [],
    };
    expect(idsOf(WHOLESALE_KPI_ROWS)).toEqual([
      'today-sales',
      'month-sales',
      'low-stock',
      'total-skus',
    ]);
    const content = contentOf(WHOLESALE_KPI_ROWS, data);
    expect(content.get('month-sales')?.value).toBe('KES 2.4M');
    expect(content.get('month-sales')?.fullValue).toBe('KES 2,400,000');
    expect(content.get('low-stock')?.footnote).toBe('All levels healthy');
  });

  it('guest house keeps its metrics, occupancy badge and profit tone', () => {
    const data: GuestHouseDashboardData = {
      occupiedRooms: 8,
      totalRooms: 12,
      occupancyRate: 67,
      revenueThisMonth: 240_000,
      costThisMonth: 90_000,
      profitThisMonth: 150_000,
      outstandingBalance: 0,
      departureAlerts: { overdue: [], today: [], tomorrow: [] },
      fastMovingStock: [],
      lowStockItems: [],
    };
    expect(idsOf(GUEST_HOUSE_KPI_ROWS)).toEqual([
      'occupied-rooms',
      'revenue-mtd',
      'profit-mtd',
      'outstanding',
    ]);
    const content = contentOf(GUEST_HOUSE_KPI_ROWS, data);
    expect(content.get('occupied-rooms')?.value).toBe('8');
    expect(content.get('occupied-rooms')?.valueSuffix).toBe('/ 12');
    expect(content.get('occupied-rooms')?.trailing).toEqual({
      kind: 'badge',
      text: '67%',
      tone: 'blue',
    });
    expect(content.get('revenue-mtd')?.value).toBe('KES 240,000');
    expect(content.get('profit-mtd')?.valueTone).toBe('success');
    expect(content.get('outstanding')?.valueTone).toBe('default');
  });

  it('retail keeps its KPI and inventory-snapshot arrangements', () => {
    const data: DashboardData = {
      greeting: { timeOfDay: 'morning' },
      kpis: {
        todaySales: 30_000,
        salesTrendLabel: '+12%',
        salesTrendIsPositive: true,
        todayExpenses: 10_000,
        expensesTrendLabel: '-5%',
        expensesTrendIsNegative: true,
        lowStockCount: 4,
        lowStockLabel: '4 items low',
        profitEstimate: 20_000,
        profitTrendLabel: '+8%',
        profitTrendIsPositive: true,
      },
      attentionFeed: [],
      inventorySnapshot: {
        total: 100,
        healthy: 80,
        low: 15,
        outOfStock: 5,
        stockHealthPct: 80,
      },
      recommendedActions: [],
    };
    expect(idsOf(RETAIL_KPI_ROWS)).toEqual([
      'today-sales',
      'expenses',
      'low-stock',
      'profit',
    ]);
    expect(idsOf(RETAIL_INVENTORY_ROWS)).toEqual([
      'inventory-healthy',
      'inventory-low',
      'inventory-out-of-stock',
      'inventory-stock-health',
    ]);
    const kpis = contentOf(RETAIL_KPI_ROWS, data);
    expect(kpis.get('today-sales')?.value).toBe('KES 30,000');
    expect(kpis.get('expenses')?.value).toBe('KES 10,000');
    expect(kpis.get('low-stock')?.valueSuffix).toBe('items');
    expect(kpis.get('profit')?.valueTone).toBe('success');
    const inventory = contentOf(RETAIL_INVENTORY_ROWS, data);
    expect(inventory.get('inventory-out-of-stock')?.value).toBe('5');
    expect(inventory.get('inventory-out-of-stock')?.footnoteTone).toBe(
      'critical',
    );
    expect(inventory.get('inventory-stock-health')?.value).toBe('80%');
  });

  it('staff keeps its metrics and task tone', () => {
    const data: StaffDashboardData = {
      greeting: { timeOfDay: 'morning' },
      kpis: {
        todaySalesCount: 14,
        todaySalesTrend: 2,
        todaySalesTrendLabel: '+2',
        lowStockCount: 0,
        totalInventory: 120,
        totalInventoryLabel: '120 items',
        tasksDoneToday: 3,
        tasksLabel: 'All caught up!',
      },
      attentionFeed: [],
      lowStockWatchList: [],
      recommendedActions: [],
    };
    expect(idsOf(STAFF_KPI_ROWS)).toEqual([
      'today-sales',
      'low-stock',
      'total-inventory',
      'tasks-done',
    ]);
    const content = contentOf(STAFF_KPI_ROWS, data);
    expect(content.get('today-sales')?.value).toBe('14');
    expect(content.get('today-sales')?.valueSuffix).toBe('units');
    expect(content.get('low-stock')?.footnote).toBe('All healthy');
    expect(content.get('tasks-done')?.footnoteTone).toBe('success');
  });

  it('every card has a unique id and a rendered value', () => {
    const arrangements: Array<{ name: string; cards: CardShell[] }> = [
      { name: 'isp', cards: shellsOf(ISP_KPI_ROWS) },
      { name: 'chemist', cards: shellsOf(CHEMIST_KPI_ROWS) },
      { name: 'restaurant', cards: shellsOf(RESTAURANT_KPI_ROWS) },
      { name: 'school', cards: shellsOf(SCHOOL_KPI_ROWS) },
      { name: 'wholesale', cards: shellsOf(WHOLESALE_KPI_ROWS) },
      { name: 'guest-house', cards: shellsOf(GUEST_HOUSE_KPI_ROWS) },
      { name: 'retail', cards: shellsOf(RETAIL_KPI_ROWS) },
      { name: 'retail-inventory', cards: shellsOf(RETAIL_INVENTORY_ROWS) },
      { name: 'staff', cards: shellsOf(STAFF_KPI_ROWS) },
    ];

    for (const { name, cards } of arrangements) {
      const ids = cards.map((card) => card.id);
      expect(ids.length, `${name} has cards`).toBeGreaterThan(0);
      expect(new Set(ids).size, `${name} ids are unique`).toBe(ids.length);
      for (const card of cards) {
        expect(card.label, `${name}/${card.id} has a label`).not.toBe('');
        expect(card.icon, `${name}/${card.id} has an icon`).toBeTruthy();
        expect([1, 2], `${name}/${card.id} has a valid span`).toContain(
          card.span ?? 1,
        );
      }
    }
  });
});
