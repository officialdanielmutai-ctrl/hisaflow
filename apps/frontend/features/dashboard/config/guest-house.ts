import { AlertTriangle, Bed, TrendingUp } from 'lucide-react';
import type { GuestHouseDashboardData } from '@/services/analytics.service';
import type { StatCardConfig } from '@/components/system/StatCard';
import { formatKpiNumber } from '@/lib/kpi-format';

/** Format a PeriodComparison delta for display, returning undefined when there
 *  is no prior data so the StatCard simply omits the badge. */
function fmtDelta(deltaPct: number | null | undefined): string | undefined {
  if (deltaPct == null) return undefined;
  return `${deltaPct >= 0 ? '+' : ''}${deltaPct}%`;
}

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
          const cmp = data.revenueComparison;
          const deltaValue = fmtDelta(cmp?.deltaPct);
          return {
            value: `KES ${revenue.display}`,
            fullValue: `KES ${revenue.full}`,
            ...(deltaValue != null && {
              delta: {
                value: deltaValue,
                period: 'vs last month',
                direction: (cmp!.deltaPct ?? 0) >= 0 ? 'up' : 'down',
                tone: (cmp!.deltaPct ?? 0) >= 0 ? 'success' : 'critical',
              },
            }),
            sparklineData:
              data.dailySeries?.revenue && data.dailySeries.revenue.length > 0
                ? data.dailySeries.revenue.map((b) => b.value)
                : data.revenueThisMonth > 0
                  ? [0, 0, 0, 0, 0, 0, data.revenueThisMonth]
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
            // Profit delta is derived from revenueComparison since the backend
            // doesn't yet expose a separate profitComparison — omit badge if
            // no prior data to avoid fabrication.
            sparklineData:
              data.dailySeries?.revenue && data.dailySeries.revenue.length > 0
                ? data.dailySeries.revenue.map((b) => b.value)
                : data.profitThisMonth !== 0
                  ? [0, 0, 0, 0, 0, 0, Math.abs(data.profitThisMonth)]
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
          const collectionPct = data.collectionHealthPct ?? (hasDebt ? 68 : 100);
          return {
            value: `KES ${outstanding.display}`,
            fullValue: `KES ${outstanding.full}`,
            valueTone: hasDebt ? 'critical' : 'default',
            footnote: hasDebt ? 'Pending guest settlement' : 'All folios cleared',
            footnoteTone: hasDebt ? 'critical' : 'success',
            progress: {
              value: collectionPct,
              max: 100,
              label: 'Collection Health',
              targetLabel: hasDebt ? 'KES due' : '100% Settled',
            },
          };
        },
      },
    ],
  ];
