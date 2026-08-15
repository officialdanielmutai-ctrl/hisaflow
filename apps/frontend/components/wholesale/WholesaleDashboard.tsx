'use client';

import useSWR from 'swr';
import { useAuth, useUser } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import Link from 'next/link';
import {
  TrendingUp, Package, AlertTriangle, Banknote, Users, Zap, ShoppingCart, Plus,
} from 'lucide-react';
import { getWholesaleDashboardData, type WholesaleDashboardData } from '@/services/analytics.service';
import DashboardLoading from '@/app/(dashboard)/loading';

export function WholesaleDashboard() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization.id;

  const { data, error, isLoading } = useSWR<WholesaleDashboardData>(
    orgId ? ['wholesale-dashboard', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return getWholesaleDashboardData(token, orgId!);
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

      {/* Outstanding Credit Banner */}
      {data.totalOutstanding > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
          <div className="h-9 w-9 rounded-full bg-red-500 flex items-center justify-center shrink-0">
            <Banknote className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700">KES {data.totalOutstanding.toLocaleString()} in outstanding credit</p>
            <p className="text-xs text-red-500">{data.openCreditCount} open credit account{data.openCreditCount !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/finance" className="text-xs font-bold text-red-600 hover:underline shrink-0">Collect →</Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/transactions"
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[var(--color-primary)] text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="h-6 w-6 mb-2" />
          <span className="text-xs font-bold text-center leading-tight">New Sale</span>
        </Link>
        <Link
          href="/inventory"
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <Package className="h-6 w-6 mb-2 text-[var(--color-primary)]" />
          <span className="text-xs font-bold text-center leading-tight">Stock</span>
        </Link>
        <Link
          href="/finance"
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <Banknote className="h-6 w-6 mb-2 text-[var(--color-primary)]" />
          <span className="text-xs font-bold text-center leading-tight">Credits</span>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/transactions?type=SALE" className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm hover:bg-[var(--color-bg-base)] transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Today's Sales</p>
              <p className="text-xl font-bold">KES {data.todaySales.toLocaleString()}</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-green-600">Gross revenue</span>
        </Link>

        <Link href="/transactions?type=SALE" className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm hover:bg-[var(--color-bg-base)] transition-colors">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Month Sales</p>
              <p className="text-xl font-bold">KES {data.monthSales.toLocaleString()}</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-blue-600">Month to date</span>
        </Link>

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
            {data.lowStockCount > 0 ? 'Restock needed' : 'All levels healthy'}
          </span>
        </Link>

        <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Total SKUs</p>
              <p className="text-xl font-bold">{data.totalItems}</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">Active products</span>
        </div>
      </div>

      {/* Top Debtors */}
      {data.topDebtors.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Top Outstanding Accounts</h2>
            <Link href="/finance" className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center">
              View all <span className="ml-1 text-lg leading-none">›</span>
            </Link>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
            {data.topDebtors.map((debtor, idx) => (
              <div key={debtor.id} className={`flex items-center justify-between px-4 py-3 ${idx !== data.topDebtors.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{debtor.clientName}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${debtor.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {debtor.status}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-bold text-red-600">KES {debtor.amountOwed.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Sellers */}
      {data.topSellers.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Top Selling Products (7 days)</h2>
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
