import { AlertTriangle, Bed, TrendingUp } from 'lucide-react';
import type { GuestHouseDashboardData } from '@/services/analytics.service';
import type { StatCardConfig } from '@/components/system/StatCard';
import { formatKpiNumber } from '@/lib/kpi-format';

/**
 * Guest-house dashboard arrangement (overhaul Section 2.5).
 *
 * Only the cards, their order and their width live here; the shared
 * `StatCard` owns the layout, sizing, formatting and states.
 */
export const GUEST_HOUSE_KPI_ROWS: StatCardConfig<GuestHouseDashboardData>[][] =
  [
    [
      {
        id: 'occupied-rooms',
        label: 'Occupied Rooms',
        icon: Bed,
        iconTone: 'hero',
        cardTone: 'hero',
        href: '/rooms',
        build: (data) => ({
          value: `${data.occupiedRooms}`,
          valueSuffix: `/ ${data.totalRooms}`,
          trailing: {
            kind: 'badge',
            text: `${data.occupancyRate}%`,
            tone: 'blue',
          },
          gauge: {
            value: data.occupancyRate,
            max: 100,
            label: 'Occupancy Rate',
          },
        }),
      },
      {
        id: 'revenue-mtd',
        label: 'Revenue (MTD)',
        icon: TrendingUp,
        iconTone: 'emerald',
        cardTone: 'neutral',
        href: '/finance',
        build: (data) => {
          const revenue = formatKpiNumber(data.revenueThisMonth);
          return {
            value: `KES ${revenue.display}`,
            fullValue: `KES ${revenue.full}`,
            delta: {
              value: '+15%',
              period: 'vs last month',
              direction: 'up',
              tone: 'success',
            },
            sparklineData: [40, 55, 60, 78, 65, 88, 92],
          };
        },
      },
    ],
    [
      {
        id: 'profit-mtd',
        label: 'Profit Est (MTD)',
        icon: TrendingUp,
        iconTone: 'emerald',
        cardTone: 'neutral',
        href: '/finance',
        build: (data) => {
          const profit = formatKpiNumber(data.profitThisMonth);
          return {
            value: `KES ${profit.display}`,
            fullValue: `KES ${profit.full}`,
            valueTone: data.profitThisMonth >= 0 ? 'success' : 'critical',
          };
        },
      },
      {
        id: 'outstanding',
        label: 'Outstanding',
        icon: AlertTriangle,
        iconTone: 'rose',
        cardTone: 'neutral',
        href: '/finance',
        build: (data) => {
          const outstanding = formatKpiNumber(data.outstandingBalance);
          return {
            value: `KES ${outstanding.display}`,
            fullValue: `KES ${outstanding.full}`,
            valueTone: data.outstandingBalance > 0 ? 'critical' : 'default',
          };
        },
      },
    ],
  ];
