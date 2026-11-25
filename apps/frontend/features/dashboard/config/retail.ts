import {
  AlertTriangle,
  Coins,
  Package,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import type { DashboardData } from '@/services/analytics.service';
import type { StatCardConfig } from '@/components/system/StatCard';
import { formatKpiNumber } from '@/lib/kpi-format';

/** Format a PeriodComparison delta for display, returning undefined when there
 *  is no prior data so the StatCard simply omits the badge. */
function fmtDelta(deltaPct: number | null | undefined): string | undefined {
  if (deltaPct == null) return undefined;
  return `${deltaPct >= 0 ? '+' : ''}${deltaPct}%`;
}

/**
 * Retail (duka / mini-mart) dashboard arrangement (overhaul Section 2.5).
 *
 * Only the cards, their order and their width live here; the shared
 * `StatCard` owns the layout, sizing, formatting and states.
 */
export const RETAIL_KPI_ROWS: StatCardConfig<DashboardData>[][] = [
  [
    {
      id: 'today-sales',
      label: "Today's Sales",
      icon: TrendingUp,
      iconTone: 'emerald',
      cardTone: 'hero',
      href: '/transactions?type=SALE',
      build: (data) => {
        const sales = formatKpiNumber(data.kpis.todaySales);
        const cmp = data.selectedPeriod?.salesComparison;
        const deltaValue = fmtDelta(cmp?.deltaPct);
        return {
          value: `KES ${sales.display}`,
          fullValue: `KES ${sales.full}`,
          footnote: data.kpis.salesTrendLabel,
          footnoteTone: data.kpis.salesTrendIsPositive ? 'success' : 'critical',
          ...(deltaValue != null && {
            delta: {
              value: deltaValue,
              period: 'vs yesterday',
              direction: (cmp!.deltaPct ?? 0) >= 0 ? 'up' : 'down',
              tone: (cmp!.deltaPct ?? 0) >= 0 ? 'success' : 'critical',
            },
          }),
          sparklineData:
            data.selectedPeriod?.sevenDaySales && data.selectedPeriod.sevenDaySales.length > 0
              ? data.selectedPeriod.sevenDaySales.map((b) => b.value)
              : [0, 0, 0, 0, 0, 0, data.kpis.todaySales],
        };
      },
    },
    {
      id: 'expenses',
      label: 'Expenses',
      icon: ShoppingCart,
      iconTone: 'rose',
      cardTone: 'neutral',
      href: '/transactions?type=PURCHASE',
      build: (data) => {
        const expenses = formatKpiNumber(data.kpis.todayExpenses);
        const cmp = data.selectedPeriod?.expensesComparison;
        const deltaValue = fmtDelta(cmp?.deltaPct);
        return {
          value: `KES ${expenses.display}`,
          fullValue: `KES ${expenses.full}`,
          footnote: data.kpis.expensesTrendLabel,
          footnoteTone: data.kpis.expensesTrendIsNegative
            ? 'critical'
            : 'success',
          ...(deltaValue != null && {
            delta: {
              value: deltaValue,
              period: 'vs yesterday',
              direction: (cmp!.deltaPct ?? 0) >= 0 ? 'up' : 'down',
              tone: data.kpis.expensesTrendIsNegative ? 'success' : 'critical',
            },
          }),
          sparklineData:
            data.selectedPeriod?.sevenDayExpenses && data.selectedPeriod.sevenDayExpenses.length > 0
              ? data.selectedPeriod.sevenDayExpenses.map((b) => b.value)
              : [0, 0, 0, 0, 0, 0, data.kpis.todayExpenses],
        };
      },
    },
  ],
  [
    {
      id: 'low-stock',
      label: 'Low Stock',
      icon: AlertTriangle,
      iconTone: 'amber',
      cardTone: 'neutral',
      href: '/inventory?filter=LOW_STOCK',
      build: (data) => ({
        value: `${data.kpis.lowStockCount}`,
        valueSuffix: 'items',
        footnote: data.kpis.lowStockLabel,
        footnoteTone: data.kpis.lowStockCount > 0 ? 'warning' : 'success',
        progress: {
          value: Math.max(0, 100 - data.kpis.lowStockCount * 8),
          max: 100,
          label: 'Stock Health',
          targetLabel: `${data.kpis.lowStockCount} items low`,
        },
      }),
    },
    {
      id: 'profit',
      label: 'Profit Est.',
      icon: Coins,
      iconTone: 'emerald',
      cardTone: 'neutral',
      href: '/finance',
      build: (data) => {
        const profit = formatKpiNumber(data.kpis.profitEstimate);
        const cmp = data.selectedPeriod?.profitComparison;
        const deltaValue = fmtDelta(cmp?.deltaPct);
        return {
          value: `KES ${profit.display}`,
          fullValue: `KES ${profit.full}`,
          valueTone: data.kpis.profitEstimate >= 0 ? 'success' : 'critical',
          footnote: data.kpis.profitTrendLabel,
          footnoteTone: data.kpis.profitTrendIsPositive
            ? 'success'
            : 'critical',
          ...(deltaValue != null && {
            delta: {
              value: deltaValue,
              period: 'vs yesterday',
              direction: (cmp!.deltaPct ?? 0) >= 0 ? 'up' : 'down',
              tone: (cmp!.deltaPct ?? 0) >= 0 ? 'success' : 'critical',
            },
          }),
          sparklineData:
            data.selectedPeriod?.sevenDayProfit && data.selectedPeriod.sevenDayProfit.length > 0
              ? data.selectedPeriod.sevenDayProfit.map((b) => b.value)
              : [0, 0, 0, 0, 0, 0, Math.abs(data.kpis.profitEstimate)],
        };
      },
    },
  ],
];

/**
 * Retail inventory snapshot. It is a second arrangement the retail dashboard
 * renders with the same shared card — not a separate card implementation.
 */
export const RETAIL_INVENTORY_ROWS: StatCardConfig<DashboardData>[][] = [
  [
    {
      id: 'inventory-healthy',
      label: 'Healthy items',
      icon: Package,
      iconTone: 'emerald',
      cardTone: 'neutral',
      build: (data) => ({
        value: `${data.inventorySnapshot.healthy}`,
        footnote: 'Good',
        footnoteTone: 'success',
      }),
    },
    {
      id: 'inventory-low',
      label: 'Low stock',
      icon: AlertTriangle,
      iconTone: 'amber',
      cardTone: 'neutral',
      build: (data) => ({
        value: `${data.inventorySnapshot.low}`,
        footnote: 'Watch',
        footnoteTone: 'warning',
      }),
    },
  ],
  [
    {
      id: 'inventory-out-of-stock',
      label: 'Out of stock',
      icon: AlertTriangle,
      iconTone: 'rose',
      cardTone: 'neutral',
      build: (data) => ({
        value: `${data.inventorySnapshot.outOfStock}`,
        footnote: 'Urgent',
        footnoteTone: 'critical',
      }),
    },
    {
      id: 'inventory-stock-health',
      label: 'Stock health',
      icon: TrendingUp,
      iconTone: 'blue',
      cardTone: 'neutral',
      build: (data) => ({
        value: `${data.inventorySnapshot.stockHealthPct}%`,
        footnote: 'Good',
      }),
    },
  ],
];
