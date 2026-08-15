'use client';

import useSWR from 'swr';
import { useAuth, useUser } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import Link from 'next/link';
import {
  TrendingUp, AlertTriangle, Package, Plus, Pill,
  CalendarX, ShoppingCart, Zap,
} from 'lucide-react';
import { getChemistDashboardData, type ChemistDashboardData } from '@/services/analytics.service';
import DashboardLoading from '@/app/(dashboard)/loading';
import { format } from 'date-fns';

export function ChemistDashboard() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization.id;

  const { data, error, isLoading } = useSWR<ChemistDashboardData>(
    orgId ? ['chemist-dashboard', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return getChemistDashboardData(token, orgId!);
    },
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

      {/* Urgent Expiry Banner */}
      {data.expiredBatches.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
          <div className="h-9 w-9 rounded-full bg-red-500 flex items-center justify-center shrink-0">
            <CalendarX className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700">{data.expiredBatches.length} batch{data.expiredBatches.length > 1 ? 'es' : ''} expiring within 30 days</p>
            <p className="text-xs text-red-500 truncate">{data.expiredBatches.slice(0, 2).map(b => b.productName).join(', ')}{data.expiredBatches.length > 2 ? '...' : ''}</p>
          </div>
          <Link href="/inventory" className="text-xs font-bold text-red-600 hover:underline shrink-0">View →</Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/inventory"
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[var(--color-primary)] text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          <Pill className="h-6 w-6 mb-2" />
          <span className="text-xs font-bold text-center leading-tight">Stock</span>
        </Link>
        <Link
          href="/transactions"
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <ShoppingCart className="h-6 w-6 mb-2 text-[var(--color-primary)]" />
          <span className="text-xs font-bold text-center leading-tight">Sales</span>
        </Link>
        <Link
          href="/inventory"
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <Plus className="h-6 w-6 mb-2 text-[var(--color-primary)]" />
          <span className="text-xs font-bold text-center leading-tight">Restock</span>
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
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Today's Sales</p>
              <p className="text-xl font-bold">KES {data.todaySales.toLocaleString()}</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">Dispensed today</span>
        </div>

        <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Month Sales</p>
              <p className="text-xl font-bold">KES {data.monthSales.toLocaleString()}</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">Month to date</span>
        </div>

        <Link href="/inventory?filter=LOW_STOCK" className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm hover:bg-[var(--color-bg-base)] transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Low Stock</p>
              <p className="text-xl font-bold">{data.lowStockCount}</p>
            </div>
          </div>
          <span className={`text-[10px] font-semibold ${data.lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {data.lowStockCount > 0 ? 'Needs restocking' : 'All levels healthy'}
          </span>
        </Link>

        <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Products</p>
              <p className="text-xl font-bold">{data.totalItems}</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">Active stock lines</span>
        </div>
      </div>

      {/* Expiring Soon */}
      {data.expiringBatches.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Expiring in 30–90 Days</h2>
            <Link href="/inventory" className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center">
              View all <span className="ml-1 text-lg leading-none">›</span>
            </Link>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50/30 overflow-hidden">
            {data.expiringBatches.slice(0, 5).map((b, idx) => (
              <div key={b.id} className={`flex items-center justify-between px-4 py-3 ${idx !== Math.min(data.expiringBatches.length, 5) - 1 ? 'border-b border-orange-100' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                    <CalendarX className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{b.productName}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">Qty: {b.quantity} · Expires {format(new Date(b.expiryDate), 'MMM d, yyyy')}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded-full shrink-0">{b.daysLeft}d left</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Sellers */}
      {data.topSellers.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Top Dispensed (7 days)</h2>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
            {data.topSellers.map((item, idx) => (
              <div key={item.itemId} className={`flex items-center justify-between px-4 py-3 ${idx !== data.topSellers.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-[var(--color-text-muted)] w-4">#{idx + 1}</span>
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">{item.name}</p>
                </div>
                <span className="text-sm font-bold text-green-600">{item.totalSold} {item.unit}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
