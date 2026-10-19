import {
  AlertTriangle,
  CheckCircle2,
  Package,
  TrendingUp,
} from 'lucide-react';
import type { StaffDashboardData } from '@/services/analytics.service';
import type { StatCardConfig } from '@/components/system/StatCard';

/**
 * Staff dashboard arrangement (overhaul Section 2.5).
 *
 * Only the cards, their order and their width live here; the shared
 * `StatCard` owns the layout, sizing, formatting and states.
 */
export const STAFF_KPI_ROWS: StatCardConfig<StaffDashboardData>[][] = [
  [
    {
      id: 'today-sales',
      label: "Today's Sales",
      icon: TrendingUp,
      iconTone: 'amber',
      cardTone: 'hero',
      build: (data) => ({
        value: `${data.kpis.todaySalesCount}`,
        valueSuffix: 'units',
        footnote: data.kpis.todaySalesTrendLabel,
        footnoteTone: data.kpis.todaySalesTrend >= 0 ? 'success' : 'critical',
        delta: {
          value: `${data.kpis.todaySalesTrend >= 0 ? '+' : ''}${data.kpis.todaySalesTrend}%`,
          period: 'vs yesterday',
          direction: data.kpis.todaySalesTrend >= 0 ? 'up' : 'down',
          tone: data.kpis.todaySalesTrend >= 0 ? 'success' : 'critical',
        },
      }),
    },
    {
      id: 'low-stock',
      label: 'Low Stock Items',
      icon: AlertTriangle,
      iconTone: 'rose',
      cardTone: 'neutral',
      href: '/inventory?filter=LOW_STOCK',
      build: (data) => ({
        value: `${data.kpis.lowStockCount}`,
        valueSuffix: 'items',
        footnote:
          data.kpis.lowStockCount > 0 ? 'Needs attention' : 'All healthy',
        footnoteTone: data.kpis.lowStockCount > 0 ? 'critical' : 'success',
      }),
    },
  ],
  [
    {
      id: 'total-inventory',
      label: 'Total Inventory',
      icon: Package,
      iconTone: 'blue',
      cardTone: 'neutral',
      href: '/inventory',
      build: (data) => ({
        value: `${data.kpis.totalInventory}`,
        valueSuffix: 'items',
        footnote: data.kpis.totalInventoryLabel,
      }),
    },
    {
      id: 'tasks-done',
      label: 'Tasks Done',
      icon: CheckCircle2,
      iconTone: 'emerald',
      cardTone: 'neutral',
      href: '/notes',
      build: (data) => ({
        value: `${data.kpis.tasksDoneToday}`,
        valueSuffix: 'today',
        footnote: data.kpis.tasksLabel,
        footnoteTone:
          data.kpis.tasksLabel === 'All caught up!' ? 'success' : 'warning',
      }),
    },
  ],
];
