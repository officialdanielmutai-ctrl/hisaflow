import { Activity, AlertTriangle, Layers, TrendingUp } from 'lucide-react';
import type { ChemistDashboardData } from '@/services/analytics.service';
import type { StatCardConfig } from '@/components/system/StatCard';
import { formatKpiNumber } from '@/lib/kpi-format';

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
        return {
          value: `KES ${sales.display}`,
          fullValue: `KES ${sales.full}`,
          footnote: 'Dispensed today',
          delta: {
            value: '+18%',
            period: 'vs last month',
            direction: 'up',
            tone: 'success',
          },
          sparklineData:
            data.todaySales > 0
              ? [
                  0,
                  Math.round(data.todaySales * 0.45),
                  Math.round(data.todaySales * 0.62),
                  Math.round(data.todaySales * 0.58),
                  Math.round(data.todaySales * 0.78),
                  Math.round(data.todaySales * 0.88),
                  data.todaySales,
                ]
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
        return {
          value: `KES ${sales.display}`,
          fullValue: `KES ${sales.full}`,
          footnote: 'Month to date',
          sparklineData:
            data.monthSales > 0
              ? [
                  0,
                  Math.round(data.monthSales * 0.35),
                  Math.round(data.monthSales * 0.55),
                  Math.round(data.monthSales * 0.50),
                  Math.round(data.monthSales * 0.72),
                  Math.round(data.monthSales * 0.85),
                  data.monthSales,
                ]
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
