'use client';

import useSWR from 'swr';
import { useAuth, useUser } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  UtensilsCrossed, ChefHat, Clock, Zap, Plus, TrendingUp, ShoppingBag,
} from 'lucide-react';
import { getRestaurantDashboardData, type RestaurantDashboardData } from '@/services/analytics.service';
import DashboardLoading from '@/app/(dashboard)/loading';
import { formatDistanceToNow } from 'date-fns';
import { DashboardKpiRows } from '@/features/dashboard/DashboardKpiRows';
import { RESTAURANT_KPI_ROWS } from '@/features/dashboard/config/restaurant';
import { TopOperationsBar } from '@/components/dashboard/TopOperationsBar';

const BentoSalesPair = dynamic(() => import('@/components/dashboard/bento/BentoSalesPair'), { ssr: false });
const BentoGrowthCard = dynamic(() => import('@/components/dashboard/bento/BentoGrowthCard'), { ssr: false });
const BentoGaugeCard = dynamic(() => import('@/components/dashboard/bento/BentoGaugeCard'), { ssr: false });
const BentoStatisticsCard = dynamic(() => import('@/components/dashboard/bento/BentoStatisticsCard'), { ssr: false });
const BentoActivityFeed = dynamic(() => import('@/components/dashboard/bento/BentoActivityFeed'), { ssr: false });

export function RestaurantDashboard() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization.id;

  const { data, error, isLoading } = useSWR<RestaurantDashboardData>(
    orgId ? ['restaurant-dashboard', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return getRestaurantDashboardData(token, orgId!);
    },
    { refreshInterval: 30000 },
  );

  if (isLoading) return <DashboardLoading />;
  if (error || !data) {
    return <div className="py-12 text-center text-[var(--color-text-secondary)]">{error?.message ?? 'No data available'}</div>;
  }

  const firstName = user?.firstName ?? 'there';
  const greetingEmoji = data.timeOfDay === 'morning' ? '👋' : data.timeOfDay === 'afternoon' ? '☀️' : '🌙';

  const shortcuts = [
    { label: '+ New Order', href: '/table-orders', icon: Plus, primary: true },
    { label: '+ Manage Tables', href: '/table-orders', icon: UtensilsCrossed },
    { label: '+ Menu Items', href: '/inventory', icon: ChefHat },
    { label: 'Dining Sales', href: '/transactions', icon: TrendingUp },
  ];

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* ── Header & Top Operations Shortcuts (Always on top for PC) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-[var(--color-text-primary)]">
            Good {data.timeOfDay}, {firstName} {greetingEmoji}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{membership?.organization.name}</p>
        </div>
        <TopOperationsBar shortcuts={shortcuts} />
      </div>

      {/* ── Desktop Bento Grid (lg+) Matching Inspo 1 ── */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-5">
        {/* Row 1 */}
        <div className="lg:col-span-4 flex flex-col">
          <BentoSalesPair
            salesAmount={data.todayRevenue}
            purchaseAmount={data.openOrdersValue}
            topLabel="Today's Revenue"
            topIcon={TrendingUp}
            bottomLabel="Pending Orders"
            bottomIcon={ShoppingBag}
            salesTrendPct={12}
            salesTrendLabel="+12%"
            purchaseTrendPct={8}
            purchaseTrendLabel="+8%"
            topHref="/table-orders"
            bottomHref="/table-orders"
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGrowthCard
            title="Dining Velocity"
            currentCount={`${data.paidOrdersToday + data.openOrdersCount} orders`}
            currentDelta="+14%"
            currentProgressPct={Math.min((data.paidOrdersToday / Math.max(data.paidOrdersToday + data.openOrdersCount, 1)) * 100, 100)}
            footerLeftLabel="Tables occupied and settled"
            footerRightLabel={`${data.paidOrdersToday} orders settled today`}
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGaugeCard
            title="Table Occupancy"
            value={data.openOrdersCount}
            totalCapacity={Math.max(data.openOrdersCount + 10, 16)}
            label="Active Tables"
            increasePct={`${data.openOrdersCount} Active`}
            footerText="Dining room seating load is"
            className="h-full"
          />
        </div>

        {/* Row 2 */}
        <div className="lg:col-span-7">
          <BentoStatisticsCard
            title="Dining Revenue & Covers Statistics"
            tab1Label="Table Orders"
            tab2Label="Covers Volume"
            headlineValue="+78%"
            headlineSubtitle="Average weekly table turnaround speed and revenue per table"
            className="h-full"
          />
        </div>
        <div className="lg:col-span-5">
          <BentoActivityFeed
            title="Active Table Orders"
            orders={
              data.openOrders.length > 0
                ? data.openOrders.slice(0, 4).map((ord) => ({
                    id: ord.id,
                    name: `${ord.tableLabel ?? 'Table'} order open`,
                    avatarText: ord.tableLabel ? ord.tableLabel.charAt(0).toUpperCase() : 'T',
                    avatarColor: 'bg-orange-500',
                    description: `${ord.itemCount} items · ${formatDistanceToNow(new Date(ord.createdAt), { addSuffix: true })}`,
                    time: 'Now',
                    value: `KES ${ord.orderValue.toLocaleString()}`,
                    badgeText: 'Dining',
                    badgeTone: 'sky' as const,
                  }))
                : [
                    {
                      id: 'no-orders',
                      name: 'No active open orders',
                      avatarText: '✓',
                      avatarColor: 'bg-emerald-500',
                      description: 'All tables cleared and settled',
                      time: 'Now',
                      value: 'KES 0',
                      badgeText: 'Clear',
                      badgeTone: 'emerald' as const,
                    },
                  ]
            }
            className="h-full"
          />
        </div>
      </div>

      {/* ── Mobile Layout (lg:hidden) ── */}
      <div className="lg:hidden flex flex-col gap-6">
        <DashboardKpiRows rows={RESTAURANT_KPI_ROWS} data={data} />
      </div>

      {/* Active Table Orders (Detailed View) */}
      {data.openOrders.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Active Orders Queue</h2>
            <Link href="/table-orders" className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center">
              Manage <span className="ml-1 text-lg leading-none">›</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.openOrders.map((ord) => (
              <Link
                key={ord.id}
                href="/table-orders"
                className="flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50/40 p-4 hover:bg-orange-50 transition-colors shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-sm">
                    {ord.tableLabel ? ord.tableLabel.charAt(0).toUpperCase() : 'T'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{ord.tableLabel ?? 'Table'}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(ord.createdAt), { addSuffix: true })} · {ord.itemCount} item{ord.itemCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-orange-700">KES {ord.orderValue.toLocaleString()}</p>
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">OPEN</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Top Menu Items */}
      {data.topMenuItems.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Top Menu Items (7 days)</h2>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden shadow-sm">
            {data.topMenuItems.map((item, idx) => (
              <div key={item.itemId} className={`flex items-center justify-between px-4 py-3 ${idx !== data.topMenuItems.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-[var(--color-text-muted)] w-4">#{idx + 1}</span>
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">{item.name}</p>
                </div>
                <span className="text-sm font-bold text-green-600">{item.totalSold} served</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
