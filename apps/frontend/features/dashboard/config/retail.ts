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
      cardTone: 'neutral',
      href: '/transactions?type=SALE',
      build: (data) => {
        const sales = formatKpiNumber(data.kpis.todaySales);
        return {
          value: `KES ${sales.display}`,
          fullValue: `KES ${sales.full}`,
          footnote: data.kpis.salesTrendLabel,
          footnoteTone: data.kpis.salesTrendIsPositive ? 'success' : 'critical',
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
        return {
          value: `KES ${expenses.display}`,
          fullValue: `KES ${expenses.full}`,
          footnote: data.kpis.expensesTrendLabel,
          footnoteTone: data.kpis.expensesTrendIsNegative
            ? 'critical'
            : 'success',
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
        return {
          value: `KES ${profit.display}`,
          fullValue: `KES ${profit.full}`,
          valueTone: data.kpis.profitEstimate >= 0 ? 'success' : 'critical',
          footnote: data.kpis.profitTrendLabel,
          footnoteTone: data.kpis.profitTrendIsPositive
            ? 'success'
            : 'critical',
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
