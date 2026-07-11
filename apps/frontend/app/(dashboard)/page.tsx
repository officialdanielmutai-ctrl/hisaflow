'use client';

import useSWR from 'swr';
import { useAuth, useUser } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import Link from 'next/link';
import {
  Bell, TrendingUp, ShoppingCart, AlertTriangle, Coins, Package,
  PackagePlus, StickyNote, Sparkles, ArrowLeftRight, CheckCircle2, Clock,
} from 'lucide-react';
import { getDashboardData, DashboardData } from '@/services/analytics.service';
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
  const { data: alerts, isLoading: alertsLoading } = useAlerts();
  const { items: inventoryItems, loading: inventoryLoading } = useInventory();

  const orgId = membership?.organization.id ?? '';
  const firstName = user?.firstName ?? 'there';

  // Fetch active notes
  const { data: notes, isLoading: notesLoading } = useSWR<Note[]>(
    orgId ? ['notes', orgId, 'active'] : null,
    async () => {
      const token = await getToken();
      if (!token) return [];
      return getNotes(token, orgId, { status: 'OPEN' });
    },
    { revalidateOnFocus: true }
  );

  // Derive time of day for greeting
  const hour = new Date().getHours();
  const timeLabel = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const greetingEmoji = hour < 12 ? '👋' : hour < 17 ? '☀️' : '🌙';

  // Low stock items
  const lowStockItems = inventoryItems
    .filter((i) => i.quantity <= i.reorderThreshold)
    .slice(0, 5);

  // Pinned / high-priority notes
  const pinnedNotes = (notes ?? [])
    .filter((n) => n.isPinned || n.importance === 'CRITICAL' || n.importance === 'HIGH')
    .slice(0, 4);

  // AI-style recommendations derived from real data
  const recommendations: { icon: string; text: string; sub: string; priority: 'HIGH' | 'MEDIUM' | 'LOW' }[] = [];
  if (lowStockItems.length > 0) {
    recommendations.push({
      icon: '📦',
      text: `Restock ${lowStockItems[0].name}`,
      sub: `Only ${lowStockItems[0].quantity} ${lowStockItems[0].unit} left — below reorder threshold of ${lowStockItems[0].reorderThreshold}`,
      priority: 'HIGH',
    });
  }
  if (lowStockItems.length > 1) {
    recommendations.push({
      icon: '⚠️',
      text: `${lowStockItems.length} items need restocking`,
      sub: `Including ${lowStockItems.slice(1, 3).map(i => i.name).join(', ')}`,
      priority: 'MEDIUM',
    });
  }
  if ((alerts ?? []).some((a) => a.severity === 'CRITICAL')) {
    recommendations.push({
      icon: '🚨',
      text: 'Critical alerts require attention',
      sub: 'Check the alerts feed and notify your manager',
      priority: 'HIGH',
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      icon: '✅',
      text: 'All stock levels look healthy',
      sub: 'Keep logging transactions to maintain accurate records',
      priority: 'LOW',
    });
  }

  const priorityColor = { HIGH: 'bg-red-500', MEDIUM: 'bg-yellow-500', LOW: 'bg-green-500' };

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* ── Greeting ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">
            Good {timeLabel}, {firstName} {greetingEmoji}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {membership?.organization.name}
          </p>
        </div>
        <Link href="/alerts" className="relative p-2">
          <Bell className="h-6 w-6" />
          {(alerts ?? []).length > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
              {(alerts ?? []).length}
            </span>
          )}
        </Link>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/transactions"
          className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 hover:border-[var(--color-accent)] transition-colors"
        >
          <div className="rounded-xl bg-[var(--color-accent)]/10 p-2.5">
            <ArrowLeftRight className="h-5 w-5 text-[var(--color-accent)]" />
          </div>
          <span className="text-xs font-semibold text-center">Log Sale</span>
        </Link>
        <Link
          href="/inventory"
          className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 hover:border-[var(--color-accent)] transition-colors"
        >
          <div className="rounded-xl bg-emerald-50 p-2.5">
            <PackagePlus className="h-5 w-5 text-emerald-600" />
          </div>
          <span className="text-xs font-semibold text-center">Add Stock</span>
        </Link>
        <Link
          href="/notes"
          className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 hover:border-[var(--color-accent)] transition-colors"
        >
          <div className="rounded-xl bg-purple-50 p-2.5">
            <StickyNote className="h-5 w-5 text-purple-600" />
          </div>
          <span className="text-xs font-semibold text-center">Notes</span>
        </Link>
      </div>

      {/* ── Stock Alerts ─────────────────────────────────────────────── */}
      {!alertsLoading && (alerts ?? []).length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-sm">⚡ Active Alerts</h2>
            <Link href="/alerts" className="text-xs text-[var(--color-accent)]">View all</Link>
          </div>
          <div className="flex flex-col gap-2">
            {(alerts ?? []).slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 rounded-xl border p-3 ${
                  alert.severity === 'CRITICAL'
                    ? 'border-red-200 bg-red-50'
                    : 'border-yellow-200 bg-yellow-50'
                }`}
              >
                <AlertTriangle
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    alert.severity === 'CRITICAL' ? 'text-red-600' : 'text-yellow-600'
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{alert.title}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-1">
                    {alert.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Low Stock Watch ───────────────────────────────────────────── */}
      {!inventoryLoading && lowStockItems.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-sm">📦 Low Stock — Watch List</h2>
            <Link href="/inventory" className="text-xs text-[var(--color-accent)]">View all</Link>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
            {lowStockItems.map((item, idx) => (
              <Link
                key={item.id}
                href="/inventory"
                className={`flex items-center justify-between px-4 py-3 hover:bg-[var(--color-bg-base)] transition-colors ${
                  idx !== lowStockItems.length - 1 ? 'border-b border-[var(--color-border)]' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${item.quantity === 0 ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  <span className="text-sm font-medium truncate">{item.name}</span>
                </div>
                <span className={`text-sm font-bold shrink-0 ml-2 ${item.quantity === 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                  {item.quantity} {item.unit}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── AI Recommendations ───────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
          <h2 className="font-bold text-sm">Smart Recommendations</h2>
        </div>
        <div className="flex flex-col gap-2">
          {recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3">
              <span className="text-lg leading-none shrink-0 mt-0.5">{rec.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">{rec.text}</p>
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityColor[rec.priority]}`} />
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{rec.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Active Notes ─────────────────────────────────────────────── */}
      {!notesLoading && pinnedNotes.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-sm">📌 Pinned Notes</h2>
            <Link href="/notes" className="text-xs text-[var(--color-accent)]">View all</Link>
          </div>
          <div className="flex flex-col gap-2">
            {pinnedNotes.map((note) => (
              <div
                key={note.id}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-tight">{note.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${importanceColors[note.importance]}`}>
                    {note.importance}
                  </span>
                </div>
                {note.content && (
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">{note.content}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                    <Clock className="h-3 w-3" />
                    {format(new Date(note.createdAt), 'MMM d')}
                  </span>
                  {note.dueDate && (
                    <span className="text-[10px] font-semibold text-orange-600">
                      Due {format(new Date(note.dueDate), 'MMM d')}
                    </span>
                  )}
                  {note.checklistItems.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                      <CheckCircle2 className="h-3 w-3" />
                      {note.checklistItems.filter(c => c.isCompleted).length}/{note.checklistItems.length}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
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
