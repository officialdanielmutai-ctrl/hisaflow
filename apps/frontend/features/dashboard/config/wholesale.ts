import { AlertTriangle, Package, ShoppingCart, TrendingUp } from 'lucide-react';
import type { WholesaleDashboardData } from '@/services/analytics.service';
import type { StatCardConfig } from '@/components/system/StatCard';
import { formatKpiNumber } from '@/lib/kpi-format';

/**
 * Wholesale dashboard arrangement (overhaul Section 2.5).
 *
 * Only the cards, their order and their width live here; the shared
 * `StatCard` owns the layout, sizing, formatting and states.
 */
export const WHOLESALE_KPI_ROWS: StatCardConfig<WholesaleDashboardData>[][] = [
  [
    {
      id: 'today-sales',
      label: "Today's Sales",
      icon: TrendingUp,
      iconTone: 'emerald',
      cardTone: 'hero',
      href: '/transactions?type=SALE',
      build: (data) => {
        const sales = formatKpiNumber(data.todaySales);
        return {
          value: `KES ${sales.display}`,
          fullValue: `KES ${sales.full}`,
          footnote: 'Gross revenue',
          delta: {
            value: '+16%',
            period: 'vs last month',
            direction: 'up',
            tone: 'success',
          },
          sparklineData: [85, 110, 105, 135, 140, 165, 180],
        };
      },
    },
    {
      id: 'month-sales',
      label: 'Month Sales',
      icon: ShoppingCart,
      iconTone: 'blue',
      cardTone: 'neutral',
      href: '/transactions?type=SALE',
      build: (data) => {
        const sales = formatKpiNumber(data.monthSales);
        return {
          value: `KES ${sales.display}`,
          fullValue: `KES ${sales.full}`,
          footnote: 'Month to date',
          sparklineData: [240, 275, 310, 295, 360, 410, 450],
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
          data.lowStockCount > 0 ? 'Restock needed' : 'All levels healthy',
        footnoteTone: data.lowStockCount > 0 ? 'critical' : 'success',
        progress: {
          value: Math.max(0, 100 - data.lowStockCount * 8),
          max: 100,
          label: 'Warehouse Stock',
          targetLabel: data.lowStockCount > 0 ? `${data.lowStockCount} lines low` : 'Optimal',
        },
      }),
    },
    {
      id: 'total-skus',
      label: 'Total SKUs',
      icon: Package,
      iconTone: 'blue',
      cardTone: 'neutral',
      build: (data) => ({
        value: `${data.totalItems}`,
        footnote: 'Active products',
        gauge: {
          value: Math.min(data.totalItems, 400),
          max: 400,
          label: 'SKU Capacity',
        },
      }),
    },
  ],
];
