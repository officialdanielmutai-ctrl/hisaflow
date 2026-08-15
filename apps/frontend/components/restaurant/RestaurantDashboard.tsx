'use client';

import useSWR from 'swr';
import { useAuth, useUser } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import Link from 'next/link';
import {
  TrendingUp, UtensilsCrossed, ChefHat, ShoppingBag, Clock, CheckCircle2, Zap, Plus,
} from 'lucide-react';
import { getRestaurantDashboardData, type RestaurantDashboardData } from '@/services/analytics.service';
import DashboardLoading from '@/app/(dashboard)/loading';
import { formatDistanceToNow } from 'date-fns';

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
    { refreshInterval: 30000 }, // refresh every 30s for live orders
  );

  if (isLoading) return <DashboardLoading />;
  if (error || !data) {
    return <div className="py-12 text-center text-[var(--color-text-secondary)]">{error?.message ?? 'No data available'}</div>;
  }

  const firstName = user?.firstName ?? 'there';
  const greetingEmoji = data.timeOfDay === 'morning' ? '👋' : data.timeOfDay === 'afternoon' ? '☀️' : '🌙';

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
          Good {data.timeOfDay}, {firstName} {greetingEmoji}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{membership?.organization.name}</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/table-orders"
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[var(--color-primary)] text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="h-6 w-6 mb-2" />
          <span className="text-xs font-bold text-center leading-tight">New Order</span>
        </Link>
        <Link
          href="/table-orders"
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <UtensilsCrossed className="h-6 w-6 mb-2 text-[var(--color-primary)]" />
          <span className="text-xs font-bold text-center leading-tight">Tables</span>
        </Link>
        <Link
          href="/inventory"
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <ChefHat className="h-6 w-6 mb-2 text-[var(--color-primary)]" />
          <span className="text-xs font-bold text-center leading-tight">Menu</span>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Today's Revenue</p>
              <p className="text-xl font-bold">KES {data.todayRevenue.toLocaleString()}</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-green-600">Live total</span>
        </div>

        <Link href="/table-orders" className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm hover:bg-[var(--color-bg-base)] transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
              <UtensilsCrossed className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Open Tables</p>
              <p className="text-xl font-bold">{data.openOrdersCount}</p>
            </div>
          </div>
          <span className={`text-[10px] font-semibold ${data.openOrdersCount > 0 ? 'text-orange-600' : 'text-[var(--color-text-muted)]'}`}>
            {data.openOrdersCount > 0 ? `KES ${data.openOrdersValue.toLocaleString()} pending` : 'Restaurant is clear'}
          </span>
        </Link>

        <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Closed Today</p>
              <p className="text-xl font-bold">{data.paidOrdersToday}</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-blue-600">Tables settled</span>
        </div>

        <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <ShoppingBag className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Pending Value</p>
              <p className="text-xl font-bold">KES {data.openOrdersValue.toLocaleString()}</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">Active orders</span>
        </div>
      </div>

      {/* Active Table Orders */}
      {data.openOrders.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Active Orders</h2>
            <Link href="/table-orders" className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center">
              Manage <span className="ml-1 text-lg leading-none">›</span>
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {data.openOrders.slice(0, 5).map((ord) => (
              <Link
                key={ord.id}
                href="/table-orders"
                className="flex items-center justify-between rounded-2xl border border-orange-200 bg-orange-50/40 p-4 hover:bg-orange-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center shrink-0 text-white font-bold text-sm">
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
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">OPEN</span>
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
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
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
