'use client';

import { useEffect, useState } from 'react';
import { useAuth, useOrganization, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { Bell, TrendingUp, ShoppingCart, AlertTriangle, Coins, Package } from 'lucide-react';
import { getDashboardData, DashboardData } from '@/services/analytics.service';
import { useRole } from '@/hooks/useRole';

export default function DashboardPage() {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const { user } = useUser();
  const { canViewAnalytics } = useRole();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const orgId = organization?.id;
    if (!orgId) {
      setLoading(false);
      return;
    }

    if (!canViewAnalytics) {
      setLoading(false);
      return;
    }

    async function fetchDashboard() {
      try {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');
        const result = await getDashboardData(token, orgId);
        setData(result);
      } catch (e: any) {
        setError(e.message ?? 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [organization?.id, getToken, canViewAnalytics]);

  const firstName = user?.firstName ?? 'there';
  const timeLabel = data?.greeting.timeOfDay ?? 'morning';
  const greetingEmoji = timeLabel === 'morning' ? '👋' : timeLabel === 'afternoon' ? '☀️' : '🌙';

  // Staff view – no analytics dashboard
  if (!canViewAnalytics) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold">
          Good {timeLabel}, {firstName} {greetingEmoji}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {organization?.name}
        </p>
        <div className="rounded-2xl border p-6 text-center">
          <p className="font-semibold">Staff View</p>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Use the Log tab to record transactions.
          </p>
        </div>
      </div>
    );
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
            {organization?.name}
          </p>
        </div>
        <Link href="/alerts" className="relative p-2">
          <Bell className="h-6 w-6" />
          {data.attentionFeed.length > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {data.attentionFeed.length}
            </span>
          )}
        </Link>
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
