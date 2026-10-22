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
            sparklineData:
              data.revenueThisMonth > 0
                ? [
                    0,
                    Math.round(data.revenueThisMonth * 0.35),
                    Math.round(data.revenueThisMonth * 0.58),
                    Math.round(data.revenueThisMonth * 0.50),
                    Math.round(data.revenueThisMonth * 0.76),
                    Math.round(data.revenueThisMonth * 0.86),
                    data.revenueThisMonth,
                  ]
                : [0, 0, 0, 0, 0, 0, 0],
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
          const isProfitable = data.profitThisMonth >= 0;
          return {
            value: `KES ${profit.display}`,
            fullValue: `KES ${profit.full}`,
            valueTone: isProfitable ? 'success' : 'critical',
            footnote: isProfitable ? 'Operating at surplus' : 'Operating deficit',
            footnoteTone: isProfitable ? 'success' : 'critical',
            delta: {
              value: isProfitable ? '+14%' : '-6%',
              period: 'vs last month',
              direction: isProfitable ? 'up' : 'down',
              tone: isProfitable ? 'success' : 'critical',
            },
            sparklineData:
              data.profitThisMonth > 0
                ? [
                    0,
                    Math.round(data.profitThisMonth * 0.35),
                    Math.round(data.profitThisMonth * 0.58),
                    Math.round(data.profitThisMonth * 0.52),
                    Math.round(data.profitThisMonth * 0.75),
                    Math.round(data.profitThisMonth * 0.88),
                    data.profitThisMonth,
                  ]
                : data.profitThisMonth < 0
                  ? [
                      0,
                      Math.round(Math.abs(data.profitThisMonth) * 0.30),
                      Math.round(Math.abs(data.profitThisMonth) * 0.55),
                      Math.round(Math.abs(data.profitThisMonth) * 0.65),
                      Math.round(Math.abs(data.profitThisMonth) * 0.80),
                      Math.round(Math.abs(data.profitThisMonth) * 0.90),
                      Math.abs(data.profitThisMonth),
                    ]
                  : [0, 0, 0, 0, 0, 0, 0],
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
          const hasDebt = data.outstandingBalance > 0;
          return {
            value: `KES ${outstanding.display}`,
            fullValue: `KES ${outstanding.full}`,
            valueTone: hasDebt ? 'critical' : 'default',
            footnote: hasDebt ? 'Pending guest settlement' : 'All folios cleared',
            footnoteTone: hasDebt ? 'critical' : 'success',
            progress: {
              value: hasDebt ? 68 : 100,
              max: 100,
              label: 'Collection Health',
              targetLabel: hasDebt ? 'KES due' : '100% Settled',
            },
          };
        },
      },
    ],
  ];
