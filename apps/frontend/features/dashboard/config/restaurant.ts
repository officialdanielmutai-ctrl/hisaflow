import { CheckCircle2, ShoppingBag, TrendingUp, UtensilsCrossed } from 'lucide-react';
import type { RestaurantDashboardData } from '@/services/analytics.service';
import type { StatCardConfig } from '@/components/system/StatCard';
import { formatKpiNumber } from '@/lib/kpi-format';

/**
 * Restaurant dashboard arrangement (overhaul Section 2.5).
 *
 * Only the cards, their order and their width live here; the shared
 * `StatCard` owns the layout, sizing, formatting and states.
 */
export const RESTAURANT_KPI_ROWS: StatCardConfig<RestaurantDashboardData>[][] = [
  [
    {
      id: 'today-revenue',
      label: "Today's Revenue",
      icon: TrendingUp,
      iconTone: 'emerald',
      cardTone: 'neutral',
      build: (data) => {
        const revenue = formatKpiNumber(data.todayRevenue);
        return {
          value: `KES ${revenue.display}`,
          fullValue: `KES ${revenue.full}`,
          footnote: 'Live total',
        };
      },
    },
    {
      id: 'open-tables',
      label: 'Open Tables',
      icon: UtensilsCrossed,
      iconTone: 'amber',
      cardTone: 'neutral',
      href: '/table-orders',
      build: (data) => {
        const pending = formatKpiNumber(data.openOrdersValue);
        return {
          value: `${data.openOrdersCount}`,
          footnote:
            data.openOrdersCount > 0
              ? `KES ${pending.display} pending`
              : 'Restaurant is clear',
          footnoteTone: data.openOrdersCount > 0 ? 'warning' : 'default',
        };
      },
    },
  ],
  [
    {
      id: 'closed-today',
      label: 'Closed Today',
      icon: CheckCircle2,
      iconTone: 'blue',
      cardTone: 'neutral',
      build: (data) => ({
        value: `${data.paidOrdersToday}`,
        footnote: 'Tables settled',
      }),
    },
    {
      id: 'pending-value',
      label: 'Pending Value',
      icon: ShoppingBag,
      iconTone: 'neutral',
      cardTone: 'neutral',
      build: (data) => {
        const pending = formatKpiNumber(data.openOrdersValue);
        return {
          value: `KES ${pending.display}`,
          fullValue: `KES ${pending.full}`,
          footnote: 'Active orders',
        };
      },
    },
  ],
];
