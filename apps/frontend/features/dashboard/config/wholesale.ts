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
      }),
    },
  ],
];
