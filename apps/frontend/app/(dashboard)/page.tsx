'use client';

import useSWR from 'swr';
import { useAuth, useUser } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import Link from 'next/link';
import {
  Bell, TrendingUp, ShoppingCart, AlertTriangle, Coins, Package,
  PackagePlus, StickyNote, Sparkles, ArrowLeftRight, CheckCircle2, Clock,
} from 'lucide-react';
import { getDashboardData, DashboardData, getStaffDashboardData, StaffDashboardData } from '@/services/analytics.service';
import { useRole } from '@/hooks/useRole';
import { useAlerts } from '@/hooks/useAlerts';
import { getNotes, type Note } from '@/services/notes.service';
import { useInventory } from '@/hooks/useInventory';
import { format } from 'date-fns';

// ── Helpers ──────────────────────────────────────────────────────────────────
const importanceColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

// ── Staff Dashboard ───────────────────────────────────────────────────────────
function StaffDashboard() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization.id ?? '';
  const firstName = user?.firstName ?? 'there';

  // Fetch the dashboard data
  const { data, isLoading, error } = useSWR<StaffDashboardData>(
    orgId ? ['staff-dashboard', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return getStaffDashboardData(token, orgId);
    },
    { revalidateOnFocus: true }
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 pb-4">
        <div className="h-20 animate-pulse rounded-2xl bg-muted" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center text-[var(--color-text-secondary)]">
        {error?.message ?? 'No data available'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* ── Greeting ─────────────────────────────────────────────────── */}
      <div className="flex flex-col">
        <h1 className="text-xl font-bold flex items-center gap-2 text-[var(--color-text-primary)]">
          Good {data.greeting.timeOfDay}, {firstName} <span className="text-2xl">👋</span>
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Here&apos;s what&apos;s happening in your store.
        </p>
      </div>

      {/* ── KPI Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
              <TrendingUp className="h-5 w-5 text-yellow-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Today&apos;s Sales</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{data.kpis.todaySalesCount}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">units</span>
              </div>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-green-600">+{data.kpis.todaySalesTrend}% vs yesterday</span>
        </div>

        <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Low Stock Items</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{data.kpis.lowStockCount}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">items</span>
              </div>
            </div>
          </div>
          <span className={`text-[10px] font-semibold ${data.kpis.lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {data.kpis.lowStockCount > 0 ? 'Needs attention' : 'All healthy'}
          </span>
        </div>

        <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Total Inventory</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{data.kpis.totalInventory}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">items</span>
              </div>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">Across all categories</span>
        </div>

        <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Tasks Done</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{data.kpis.tasksDoneToday}</span>
                <span className="text-xs text-[var(--color-text-secondary)]">today</span>
              </div>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-green-600">Great progress!</span>
        </div>
      </div>

      {/* ── Active Alerts ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="text-orange-500 font-bold text-lg leading-none mt-0.5">⚡</div>
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Active Alerts</h2>
          </div>
          <Link href="/alerts" className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center">
            View all alerts <span className="ml-1 text-lg leading-none mt-0.5">›</span>
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          {data.attentionFeed.length === 0 ? (
            <div className="text-center text-sm text-[var(--color-text-muted)] py-4 border rounded-xl bg-yellow-50/30 border-yellow-100">
              No active alerts.
            </div>
          ) : (
            data.attentionFeed.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="flex items-center gap-4 rounded-xl border border-yellow-200 bg-yellow-50/50 p-4 relative overflow-hidden"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500 shrink-0 shadow-sm z-10">
                  {alert.type === 'STAFF_ACTIVITY' ? (
                    <StickyNote className="h-5 w-5 text-white" />
                  ) : (
                    <TrendingUp className="h-5 w-5 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0 z-10">
                  <p className="text-sm font-bold text-[var(--color-text-primary)] truncate pr-20">{alert.message}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2 pr-4 leading-relaxed">
                    {alert.type === 'STAFF_ACTIVITY' ? 'Staff activity logged.' : 'Noticeable changes detected.'}
                  </p>
                </div>
                <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5 z-10">
                  <span className="rounded bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-800">
                    {alert.type === 'STAFF_ACTIVITY' ? 'Sale Logged' : 'High Activity'}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-medium flex items-center gap-0.5">
                    10m ago <span className="text-sm font-bold ml-1 leading-none">›</span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Low Stock Watch List ───────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[#C19A6B]" />
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Low Stock — Watch List</h2>
          </div>
          <Link href="/inventory" className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center">
            View all items <span className="ml-1 text-lg leading-none mt-0.5">›</span>
          </Link>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
          {data.lowStockWatchList.length === 0 ? (
            <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">No low stock items.</div>
          ) : (
            data.lowStockWatchList.map((item, idx) => (
              <Link
                key={item.id}
                href="/inventory"
                className={`flex items-center justify-between px-4 py-3 hover:bg-[var(--color-bg-base)] transition-colors ${
                  idx !== data.lowStockWatchList.length - 1 ? 'border-b border-[var(--color-border)]' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <span className="text-xs">📦</span>
                  </div>
                  <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-yellow-500" />
                  <span className="text-sm font-bold text-[var(--color-text-primary)] truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-sm font-bold text-orange-500">
                    {item.quantity} {item.unit}
                  </span>
                  <span className="text-[var(--color-text-muted)] text-lg leading-none">›</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* ── Smart Recommendations ───────────────────────────────────────── */}
      <section>
        {data.recommendedActions.length > 0 ? (
          <div className="flex flex-col rounded-2xl border border-green-200 bg-[#F4FCF7] p-4 relative shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] shadow-sm">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-[var(--color-accent)] mb-1">Smart Recommendations</h3>
                <p className="text-sm font-bold text-[var(--color-text-primary)] leading-tight mb-1">
                  {data.recommendedActions[0].action}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] pr-2 leading-relaxed">
                  {data.recommendedActions[0].reason}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="rounded-full border border-[var(--color-accent)] bg-white px-4 py-1.5 text-xs font-bold text-[var(--color-accent)] flex items-center gap-1 hover:bg-green-50 transition-colors">
                View details <span className="text-sm leading-none">›</span>
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { user } = useUser();
  const { canViewAnalytics } = useRole();

  const orgId = membership?.organization.id;

  const fetcher = async () => {
    if (!orgId) throw new Error('No organization found');
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    return getDashboardData(token, orgId);
  };

  const { data, error, isLoading } = useSWR<DashboardData>(
    canViewAnalytics && orgId ? ['dashboard', orgId] : null,
    fetcher,
    { revalidateOnFocus: true }
  );

  const loading = isLoading;
  const firstName = user?.firstName ?? 'there';
  const timeLabel = data?.greeting.timeOfDay ?? 'morning';
  const greetingEmoji = timeLabel === 'morning' ? '👋' : timeLabel === 'afternoon' ? '☀️' : '🌙';

  // Staff get their own dedicated dashboard
  if (!canViewAnalytics) {
    return <StaffDashboard />;
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center text-[var(--color-text-secondary)]">
        {error ?? 'No data available'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">
            Good {timeLabel}, {firstName} {greetingEmoji}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {membership?.organization.name}
          </p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl bg-[var(--color-bg-surface)] border p-4">
          <TrendingUp className="h-5 w-5 text-green-600 mb-2" />
          <p className="text-xs text-muted-foreground">Today&apos;s Sales</p>
          <p className="font-bold text-lg">KES {data.kpis.todaySales.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl bg-[var(--color-bg-surface)] border p-4">
          <ShoppingCart className="h-5 w-5 text-red-500 mb-2" />
          <p className="text-xs text-muted-foreground">Expenses</p>
          <p className="font-bold text-lg">KES {data.kpis.todayExpenses.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl bg-[var(--color-bg-surface)] border p-4">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mb-2" />
          <p className="text-xs text-muted-foreground">Low Stock</p>
          <p className="font-bold text-lg">{data.kpis.lowStockCount} items</p>
          <p className={`text-xs ${data.kpis.lowStockCount > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
            {data.kpis.lowStockCount > 0 ? 'Needs attention' : 'All good'}
          </p>
        </div>
        <div className="rounded-2xl bg-[var(--color-bg-surface)] border p-4">
          <Coins className="h-5 w-5 text-green-600 mb-2" />
          <p className="text-xs text-muted-foreground">Profit Est.</p>
          <p className={`font-bold text-lg ${data.kpis.profitEstimate >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            KES {data.kpis.profitEstimate.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Attention Feed */}
      {data.attentionFeed.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-base">Attention Feed</h2>
            <Link href="/alerts" className="text-sm text-[var(--color-accent)]">
              View all
            </Link>
          </div>
          {data.attentionFeed.map((alert) => (
            <div key={alert.id} className="rounded-2xl border p-4 mb-2 flex items-start gap-3">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center ${
                  alert.severity === 'CRITICAL' ? 'bg-red-100' : 'bg-yellow-100'
                }`}
              >
                <AlertTriangle
                  className={`h-5 w-5 ${
                    alert.severity === 'CRITICAL' ? 'text-red-600' : 'text-yellow-600'
                  }`}
                />
              </div>
              <p className="text-sm font-medium">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Inventory Snapshot */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-base">Inventory Snapshot</h2>
          <Link href="/inventory" className="text-sm text-[var(--color-accent)]">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[var(--color-bg-surface)] border p-4 flex flex-col gap-1">
            <Package className="h-5 w-5 text-green-600" />
            <p className="font-bold text-lg">{data.inventorySnapshot.healthy}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">Healthy items</p>
            <p className="text-xs text-green-600">Good</p>
          </div>
          <div className="rounded-2xl bg-[var(--color-bg-surface)] border p-4 flex flex-col gap-1">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <p className="font-bold text-lg">{data.inventorySnapshot.low}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">Low stock</p>
            <p className="text-xs text-yellow-600">Watch</p>
          </div>
          <div className="rounded-2xl bg-[var(--color-bg-surface)] border p-4 flex flex-col gap-1">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="font-bold text-lg">{data.inventorySnapshot.outOfStock}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">Out of stock</p>
            <p className="text-xs text-red-600">Urgent</p>
          </div>
          <div className="rounded-2xl bg-[var(--color-bg-surface)] border p-4 flex flex-col gap-1">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <p className="font-bold text-lg">{data.inventorySnapshot.stockHealthPct}%</p>
            <p className="text-sm text-[var(--color-text-secondary)]">Stock health</p>
            <p className="text-xs text-blue-600">Good</p>
          </div>
        </div>
      </div>

      {/* Recommended Actions */}
      <div className="mb-6">
        <h2 className="font-bold text-base mb-3">
          Recommended Actions
        </h2>
        {data.recommendedActions.map((rec, i) => (
          <div
            key={i}
            className="rounded-2xl border p-4 mb-2 flex items-start gap-3"
          >
            <span
              className={`h-2 w-2 rounded-full mt-2 flex-shrink-0 ${
                rec.priority === 'HIGH'
                  ? 'bg-red-500'
                  : rec.priority === 'MEDIUM'
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }`}
            />
            <div>
              <p className="text-sm font-semibold">{rec.action}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {rec.reason}
              </p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
