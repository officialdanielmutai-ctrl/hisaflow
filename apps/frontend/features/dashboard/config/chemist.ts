import { Activity, AlertTriangle, Layers, TrendingUp } from 'lucide-react';
import type { ChemistDashboardData } from '@/services/analytics.service';
import type { StatCardConfig } from '@/components/system/StatCard';
import { formatKpiNumber } from '@/lib/kpi-format';

/** Format a PeriodComparison delta for display, returning undefined when there
 *  is no prior data so the StatCard simply omits the badge. */
function fmtDelta(
  deltaPct: number | null | undefined,
): string | undefined {
  if (deltaPct == null) return undefined;
  return `${deltaPct >= 0 ? '+' : ''}${deltaPct}%`;
}

/**
 * Chemist dashboard arrangement (overhaul Section 2.5).
 *
 * Only the cards, their order and their width live here; the shared
 * `StatCard` owns the layout, sizing, formatting and states.
 */
export const CHEMIST_KPI_ROWS: StatCardConfig<ChemistDashboardData>[][] = [
  [
    {
      id: 'today-sales',
      label: "Today's Sales",
      icon: TrendingUp,
      iconTone: 'emerald',
      cardTone: 'hero',
      build: (data) => {
        const sales = formatKpiNumber(data.todaySales);
        const cmp = data.todaySalesComparison;
        const deltaValue = fmtDelta(cmp?.deltaPct);
        return {
          value: `KES ${sales.display}`,
          fullValue: `KES ${sales.full}`,
          footnote: 'Dispensed today',
          ...(deltaValue != null && {
            delta: {
              value: deltaValue,
              period: 'vs yesterday',
              direction: (cmp!.deltaPct ?? 0) >= 0 ? 'up' : 'down',
              tone: (cmp!.deltaPct ?? 0) >= 0 ? 'success' : 'critical',
            },
          }),
          sparklineData:
            data.dailySeries?.sales && data.dailySeries.sales.length > 0
              ? data.dailySeries.sales.map((b) => b.value)
              : data.todaySales > 0
                ? [0, 0, 0, 0, 0, 0, data.todaySales]
                : [0, 0, 0, 0, 0, 0, 0],
        };
      },
    },
    {
      id: 'month-sales',
      label: 'Month Sales',
      icon: Activity,
      iconTone: 'blue',
      cardTone: 'neutral',
      build: (data) => {
        const sales = formatKpiNumber(data.monthSales);
        const cmp = data.monthSalesComparison;
        const deltaValue = fmtDelta(cmp?.deltaPct);
        return {
          value: `KES ${sales.display}`,
          fullValue: `KES ${sales.full}`,
          footnote: 'Month to date',
          ...(deltaValue != null && {
            delta: {
              value: deltaValue,
              period: 'vs last month',
              direction: (cmp!.deltaPct ?? 0) >= 0 ? 'up' : 'down',
              tone: (cmp!.deltaPct ?? 0) >= 0 ? 'success' : 'critical',
            },
          }),
          sparklineData:
            data.dailySeries?.sales && data.dailySeries.sales.length > 0
              ? data.dailySeries.sales.map((b) => b.value)
              : data.monthSales > 0
                ? [0, 0, 0, 0, 0, 0, data.monthSales]
                : [0, 0, 0, 0, 0, 0, 0],
        };
      },
    },
  ],
  [
    {
      id: 'low-stock',
      label: 'Low Stock',
      icon: AlertTriangle,
      iconTone: 'rose',
      cardTone: 'neutral',
      href: '/inventory?filter=LOW_STOCK',
      build: (data) => ({
        value: `${data.lowStockCount}`,
        footnote:
          data.lowStockCount > 0 ? 'Needs restocking' : 'All levels healthy',
        footnoteTone: data.lowStockCount > 0 ? 'critical' : 'success',
        progress: {
          value: Math.max(0, 100 - data.lowStockCount * 12),
          max: 100,
          label: 'Shelf Availability',
          targetLabel: data.lowStockCount > 0 ? `${data.lowStockCount} lines low` : 'Optimal',
        },
      }),
    },
    {
      id: 'products',
      label: 'Products',
      icon: Layers,
      iconTone: 'blue',
      cardTone: 'neutral',
      build: (data) => ({
        value: `${data.totalItems}`,
        footnote: 'Active stock lines',
        gauge: {
          value: Math.min(data.totalItems, 60),
          max: 60,
          label: 'Catalog Target',
        },
      }),
    },
  ],
];
