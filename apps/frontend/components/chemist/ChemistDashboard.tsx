'use client';

import useSWR from 'swr';
import { useAuth, useUser } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import Link from 'next/link';
import {
  TrendingUp, AlertTriangle, Package, Plus, Pill,
  CalendarX, ShoppingCart, Zap, ArrowUpRight, ReceiptText,
  Activity, Clock, Layers,
} from 'lucide-react';
import { getChemistDashboardData, type ChemistDashboardData } from '@/services/analytics.service';
import DashboardLoading from '@/app/(dashboard)/loading';
import { format } from 'date-fns';
import { AiRecommendationsCard, type Recommendation } from '@/components/shared/AiRecommendationsCard';

// Derive contextual AI recommendations from chemist data
function buildChemistRecommendations(data: ChemistDashboardData): Recommendation[] {
  const recs: Recommendation[] = [];

  if (data.expiredBatches.length > 0) {
    recs.push({
      action: `Remove ${data.expiredBatches.length} expired batch${data.expiredBatches.length > 1 ? 'es' : ''} from shelves`,
      reason: `${data.expiredBatches.slice(0, 2).map(b => b.productName).join(', ')} ${data.expiredBatches.length > 2 ? 'and others are' : 'is'} expired. Dispensing expired stock is a legal and safety risk.`,
      priority: 'HIGH',
      href: '/inventory',
    });
  }

  if (data.expiringBatches.length > 0) {
    const soonest = data.expiringBatches[0];
    recs.push({
      action: `Prioritise dispensing ${soonest.productName} first`,
      reason: `${soonest.quantity} units expire in ${soonest.daysLeft} days. Selling soon-to-expire items first reduces write-offs.`,
      priority: 'MEDIUM',
      href: '/inventory',
    });
  }

  if (data.lowStockCount > 0) {
    recs.push({
      action: `Restock ${data.lowStockCount} low-stock medication${data.lowStockCount > 1 ? 's' : ''}`,
      reason: 'Running out of key stock can disrupt patient care and lose sales. Place purchase orders today.',
      priority: data.lowStockCount > 5 ? 'HIGH' : 'MEDIUM',
      href: '/inventory',
    });
  }

  if (data.topSellers.length > 0) {
    const top = data.topSellers[0];
    recs.push({
      action: `Ensure ${top.name} is always in stock`,
      reason: `It's your #1 dispensed item this week (${top.totalSold} ${top.unit}). A stockout would directly impact revenue.`,
      priority: 'LOW',
      href: '/inventory',
    });
  }

  if (data.todaySales === 0) {
    recs.push({
      action: 'No sales recorded today — check if transactions are being logged',
      reason: 'If the pharmacy is open, sales should appear here. Verify your staff are recording each dispensing.',
      priority: 'MEDIUM',
      href: '/transactions',
    });
  }

  return recs;
}

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
  const recommendations = buildChemistRecommendations(data);

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
          Good {data.timeOfDay}, {firstName} {greetingEmoji}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{membership?.organization.name}</p>
      </div>

      {/* Urgent Expired Banner */}
      {data.expiredBatches.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
          <div className="h-9 w-9 rounded-full bg-red-500 flex items-center justify-center shrink-0">
            <CalendarX className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700">
              {data.expiredBatches.length} batch{data.expiredBatches.length > 1 ? 'es' : ''} have expired
            </p>
            <p className="text-xs text-red-500 truncate">
              {data.expiredBatches.slice(0, 2).map(b => b.productName).join(', ')}
              {data.expiredBatches.length > 2 ? '...' : ''}
            </p>
          </div>
          <Link href="/inventory" className="text-xs font-bold text-red-600 hover:underline shrink-0">
            View →
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2">
        <Link
          href="/inventory"
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[var(--color-primary)] text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          <Pill className="h-5 w-5 mb-1.5" />
          <span className="text-[11px] font-bold text-center leading-tight">Stock</span>
        </Link>
        <Link
          href="/transactions"
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <ShoppingCart className="h-5 w-5 mb-1.5 text-[var(--color-primary)]" />
          <span className="text-[11px] font-bold text-center leading-tight">Sales</span>
        </Link>
        <Link
          href="/transactions"
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <ReceiptText className="h-5 w-5 mb-1.5 text-[var(--color-primary)]" />
          <span className="text-[11px] font-bold text-center leading-tight">Receipts</span>
        </Link>
        <Link
          href="/inventory"
          className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <Plus className="h-5 w-5 mb-1.5 text-[var(--color-primary)]" />
          <span className="text-[11px] font-bold text-center leading-tight">Restock</span>
        </Link>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Today's Sales</p>
          </div>
          <p className="text-xl font-bold">KES {data.todaySales.toLocaleString()}</p>
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)] mt-1">Dispensed today</span>
        </div>

        <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Activity className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Month Sales</p>
          </div>
          <p className="text-xl font-bold">KES {data.monthSales.toLocaleString()}</p>
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)] mt-1">Month to date</span>
        </div>

        <Link
          href="/inventory?filter=LOW_STOCK"
          className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm hover:bg-[var(--color-bg-base)] transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Low Stock</p>
          </div>
          <p className="text-xl font-bold">{data.lowStockCount}</p>
          <span className={`text-[10px] font-semibold mt-1 ${data.lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {data.lowStockCount > 0 ? 'Needs restocking' : 'All levels healthy'}
          </span>
        </Link>

        <Link
          href="/inventory"
          className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm hover:bg-[var(--color-bg-base)] transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <Layers className="h-4 w-4 text-purple-600" />
            </div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Products</p>
          </div>
          <p className="text-xl font-bold">{data.totalItems}</p>
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)] mt-1">Active stock lines</span>
        </Link>
      </div>

      {/* AI Recommendations */}
      <AiRecommendationsCard recommendations={recommendations} />

      {/* Active Alerts */}
      {data.alerts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Active Alerts</h2>
          </div>
          <div className="flex flex-col gap-2">
            {data.alerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  alert.severity === 'CRITICAL'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <AlertTriangle
                  className={`h-4 w-4 shrink-0 ${
                    alert.severity === 'CRITICAL' ? 'text-red-600' : 'text-yellow-600'
                  }`}
                />
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{alert.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Expiring Soon */}
      {data.expiringBatches.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Expiring in 30–90 Days</h2>
            <Link href="/inventory" className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center gap-0.5">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50/30 overflow-hidden">
            {data.expiringBatches.slice(0, 5).map((b, idx) => (
              <div
                key={b.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  idx !== Math.min(data.expiringBatches.length, 5) - 1 ? 'border-b border-orange-100' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                    <CalendarX className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{b.productName}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Qty: {b.quantity} · Expires {format(new Date(b.expiryDate), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded-full shrink-0">
                  {b.daysLeft}d left
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Dispensed */}
      {data.topSellers.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Top Dispensed (7 days)</h2>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
            {data.topSellers.map((item, idx) => (
              <div
                key={item.itemId}
                className={`flex items-center justify-between px-4 py-3 ${
                  idx !== data.topSellers.length - 1 ? 'border-b border-[var(--color-border)]' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-[var(--color-text-muted)] w-4">#{idx + 1}</span>
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">{item.name}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-green-600">{item.totalSold}</span>
                  <span className="text-xs text-[var(--color-text-secondary)]">{item.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Finance Snapshot */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Finance Snapshot</h2>
          <Link href="/finance" className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center gap-0.5">
            Full report <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] divide-y divide-[var(--color-border)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-[var(--color-text-secondary)]" />
              <span className="text-sm text-[var(--color-text-primary)]">Today's Revenue</span>
            </div>
            <span className="text-sm font-bold text-green-600">KES {data.todaySales.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Package className="h-4 w-4 text-[var(--color-text-secondary)]" />
              <span className="text-sm text-[var(--color-text-primary)]">Month Revenue</span>
            </div>
            <span className="text-sm font-bold text-blue-600">KES {data.monthSales.toLocaleString()}</span>
          </div>
          <Link href="/transactions" className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-bg-base)] transition-colors">
            <div className="flex items-center gap-3">
              <ReceiptText className="h-4 w-4 text-[var(--color-text-secondary)]" />
              <span className="text-sm text-[var(--color-text-primary)]">All Transactions</span>
            </div>
            <ArrowUpRight className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </Link>
        </div>
      </section>
    </div>
  );
}
