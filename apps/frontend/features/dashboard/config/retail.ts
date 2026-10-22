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
      cardTone: 'hero',
      href: '/transactions?type=SALE',
      build: (data) => {
        const sales = formatKpiNumber(data.kpis.todaySales);
        return {
          value: `KES ${sales.display}`,
          fullValue: `KES ${sales.full}`,
          footnote: data.kpis.salesTrendLabel,
          footnoteTone: data.kpis.salesTrendIsPositive ? 'success' : 'critical',
          delta: {
            value: data.kpis.salesTrendPct != null
              ? `${data.kpis.salesTrendPct >= 0 ? '+' : ''}${data.kpis.salesTrendPct}%`
              : data.kpis.salesTrendLabel?.includes('%')
                ? data.kpis.salesTrendLabel.split(' ')[0]
                : '0%',
            period: 'vs last month',
            direction: data.kpis.salesTrendIsPositive ? 'up' : 'down',
            tone: data.kpis.salesTrendIsPositive ? 'success' : 'critical',
          },
          sparklineData:
            data.kpis.todaySales > 0
              ? [
                  0,
                  Math.round(data.kpis.todaySales * 0.38),
                  Math.round(data.kpis.todaySales * 0.60),
                  Math.round(data.kpis.todaySales * 0.52),
                  Math.round(data.kpis.todaySales * 0.75),
                  Math.round(data.kpis.todaySales * 0.88),
                  data.kpis.todaySales,
                ]
              : [0, 0, 0, 0, 0, 0, 0],
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
          delta: {
            value: data.kpis.expensesTrendPct != null
              ? `${data.kpis.expensesTrendPct >= 0 ? '+' : ''}${data.kpis.expensesTrendPct}%`
              : data.kpis.expensesTrendLabel?.includes('%')
                ? data.kpis.expensesTrendLabel.split(' ')[0]
                : '0%',
            period: 'vs last month',
            direction: data.kpis.expensesTrendIsNegative ? 'down' : 'up',
            tone: data.kpis.expensesTrendIsNegative ? 'success' : 'critical',
          },
          sparklineData:
            data.kpis.todayExpenses > 0
              ? [
                  0,
                  Math.round(data.kpis.todayExpenses * 0.30),
                  Math.round(data.kpis.todayExpenses * 0.55),
                  Math.round(data.kpis.todayExpenses * 0.45),
                  Math.round(data.kpis.todayExpenses * 0.68),
                  Math.round(data.kpis.todayExpenses * 0.82),
                  data.kpis.todayExpenses,
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
        return {
          value: `KES ${profit.display}`,
          fullValue: `KES ${profit.full}`,
          valueTone: data.kpis.profitEstimate >= 0 ? 'success' : 'critical',
          footnote: data.kpis.profitTrendLabel,
          footnoteTone: data.kpis.profitTrendIsPositive
            ? 'success'
            : 'critical',
          sparklineData:
            data.kpis.profitEstimate > 0
              ? [
                  0,
                  Math.round(data.kpis.profitEstimate * 0.32),
                  Math.round(data.kpis.profitEstimate * 0.55),
                  Math.round(data.kpis.profitEstimate * 0.48),
                  Math.round(data.kpis.profitEstimate * 0.70),
                  Math.round(data.kpis.profitEstimate * 0.85),
                  data.kpis.profitEstimate,
                ]
              : data.kpis.profitEstimate < 0
                ? [
                    0,
                    Math.round(Math.abs(data.kpis.profitEstimate) * 0.20),
                    Math.round(Math.abs(data.kpis.profitEstimate) * 0.45),
                    Math.round(Math.abs(data.kpis.profitEstimate) * 0.60),
                    Math.round(Math.abs(data.kpis.profitEstimate) * 0.75),
                    Math.round(Math.abs(data.kpis.profitEstimate) * 0.90),
                    Math.abs(data.kpis.profitEstimate),
                  ]
                : [0, 0, 0, 0, 0, 0, 0],
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
