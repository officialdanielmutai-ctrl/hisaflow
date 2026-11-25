import { CircleDollarSign, Headphones, Radio, Wrench } from 'lucide-react';
import type { IspDashboardData } from '@/services/isp.service';
import type { StatCardConfig } from '@/components/system/StatCard';
import { formatGrouped, formatKpiNumber } from '@/lib/kpi-format';

/** Format a PeriodComparison delta for display, returning undefined when there
 *  is no prior data so the StatCard simply omits the badge. */
function fmtDelta(deltaPct: number | null | undefined): string | undefined {
  if (deltaPct == null) return undefined;
  return `${deltaPct >= 0 ? '+' : ''}${deltaPct}%`;
}

/**
 * ISP dashboard arrangement (overhaul Section 2.5).
 *
 * The *card* is shared (`StatCard`); this file declares only which KPI cards
 * the ISP home screen shows, in what order and at what width. Editing the
 * arrangement means editing this list, not the card.
 */
export const ISP_KPI_ROWS: StatCardConfig<IspDashboardData>[][] = [
  [
    {
      id: 'monthly-revenue',
      label: 'Monthly Revenue',
      icon: CircleDollarSign,
      iconTone: 'hero',
      cardTone: 'hero',
      href: '/finance',
      build: (data) => {
        const revenue = formatKpiNumber(data.monthlyRevenue);
        const arpu =
          data.subscribers.active > 0
            ? Math.round(data.monthlyRevenue / data.subscribers.active)
            : 0;
        const cmp = data.revenueComparison;
        const deltaValue = fmtDelta(cmp?.deltaPct);
        return {
          sublabel: 'Recurring Invoicing',
          value: `KES ${revenue.display}`,
          fullValue: `KES ${revenue.full}`,
          footnote:
            data.subscribers.active > 0
              ? `KES ${formatGrouped(arpu)} ARPU / active sub`
              : 'No billing activity yet',
          trailing: { kind: 'arrow' },
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
              : data.monthlyRevenue > 0
                ? [0, 0, 0, 0, 0, 0, data.monthlyRevenue]
                : [0, 0, 0, 0, 0, 0, 0],
        };
      },
    },
    {
      id: 'active-subscribers',
      label: 'Active Subscribers',
      icon: Radio,
      cardTone: 'emerald',
      href: '/subscribers',
      build: (data) => {
        const total = data.subscribers.total || 0;
        const activePct =
          total > 0 ? Math.round((data.subscribers.active / total) * 100) : 0;
        return {
          sublabel: `Total Fleet: ${total}`,
          value: `${data.subscribers.active}`,
          valueSuffix: `/ ${total}`,
          footnote:
            data.subscribers.suspended > 0
              ? `${data.subscribers.suspended} suspended • ${activePct}% online`
              : `${activePct}% fleet online`,
          trailing: { kind: 'arrow' },
          gauge: {
            value: activePct,
            max: 100,
            label: 'Online',
          },
        };
      },
    },
  ],
  [
    {
      id: 'work-orders',
      label: 'Field Work & Dispatch',
      icon: Wrench,
      iconTone: 'amber',
      cardTone: 'neutral',
      href: '/work-orders',
      build: (data) => ({
        sublabel: 'Technician Deployments',
        value: `${data.scheduledWorkOrders}`,
        footnote:
          data.scheduledWorkOrders > 0
            ? `${data.scheduledWorkOrders} job${data.scheduledWorkOrders > 1 ? 's' : ''} scheduled`
            : 'No pending field dispatches',
        trailing:
          data.scheduledWorkOrders > 0
            ? { kind: 'badge', text: `${data.scheduledWorkOrders} Pending`, tone: 'amber' }
            : { kind: 'badge', text: 'All Clear', tone: 'emerald' },
        progress: {
          value: Math.max(0, 100 - data.scheduledWorkOrders * 15),
          max: 100,
          label: 'Crew Utilization',
          targetLabel: `${data.scheduledWorkOrders} Jobs`,
        },
      }),
    },
    {
      id: 'support-queue',
      label: 'Support Queue',
      icon: Headphones,
      iconTone: 'rose',
      cardTone: 'neutral',
      href: '/tickets',
      build: (data) => ({
        sublabel: 'Subscriber Complaints',
        value: `${data.openTickets}`,
        footnote:
          data.openTickets > 0
            ? `${data.openTickets} ticket${data.openTickets > 1 ? 's' : ''} awaiting review`
            : 'All subscriber tickets resolved',
        trailing:
          data.openTickets > 0
            ? { kind: 'badge', text: `${data.openTickets} Open`, tone: 'rose' }
            : { kind: 'badge', text: 'Resolved', tone: 'emerald' },
        // Use real ticket-series data when available; fall back to honest zeros
        sparklineData:
          data.dailySeries?.tickets && data.dailySeries.tickets.length > 0
            ? data.dailySeries.tickets.map((b) => b.value)
            : [0, 0, 0, 0, 0, 0, 0],
      }),
    },
  ],
];
