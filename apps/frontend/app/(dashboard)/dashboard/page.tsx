'use client'

import useSWR from 'swr'
import dynamic from 'next/dynamic'
import { useAuth, useUser } from '@clerk/nextjs'
import { useMyOrganization } from '@/hooks/useMyOrganization'
import { useDateRange } from '@/components/providers/DateRangeProvider'
import Link from 'next/link'
import {
  TrendingUp,
  AlertTriangle,
  Package,
  StickyNote,
  Sparkles,
  ShoppingCart,
  QrCode,
} from 'lucide-react'
import { TopOperationsBar } from '@/components/dashboard/TopOperationsBar'
import {
  DashboardGreeting,
  type TimeOfDay,
} from '@/components/dashboard/DashboardGreeting'
import {
  getDashboardData,
  DashboardData,
  getStaffDashboardData,
  StaffDashboardData,
} from '@/services/analytics.service'
import { useRole } from '@/hooks/useRole'
import DashboardLoading from '../loading'
import { GuestHouseDashboard } from '@/components/guesthouse/GuestHouseDashboard'
import { SchoolDashboard } from '@/components/school/SchoolDashboard'
import { ChemistDashboard } from '@/components/chemist/ChemistDashboard'
import { RestaurantDashboard } from '@/components/restaurant/RestaurantDashboard'
import { WholesaleDashboard } from '@/components/wholesale/WholesaleDashboard'
import { IspDashboard } from '@/components/isp/IspDashboard'
import { DashboardKpiRows } from '@/features/dashboard/DashboardKpiRows'
import {
  RETAIL_KPI_ROWS,
  RETAIL_INVENTORY_ROWS,
} from '@/features/dashboard/config/retail'
import { STAFF_KPI_ROWS } from '@/features/dashboard/config/staff'
import { formatKpiNumber } from '@/lib/kpi-format'

const ModernAnalyticsChart = dynamic(
  () => import('@/components/charts/ModernAnalyticsChart'),
  { ssr: false }
)
const BentoSalesPair = dynamic(
  () => import('@/components/dashboard/bento/BentoSalesPair'),
  { ssr: false }
)
const BentoGrowthCard = dynamic(
  () => import('@/components/dashboard/bento/BentoGrowthCard'),
  { ssr: false }
)
const BentoGaugeCard = dynamic(
  () => import('@/components/dashboard/bento/BentoGaugeCard'),
  { ssr: false }
)
const BentoStatisticsCard = dynamic(
  () => import('@/components/dashboard/bento/BentoStatisticsCard'),
  { ssr: false }
)
const BentoActivityFeed = dynamic(
  () => import('@/components/dashboard/bento/BentoActivityFeed'),
  { ssr: false }
)

// ── Staff Dashboard ───────────────────────────────────────────────────────────
function StaffDashboard() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { membership } = useMyOrganization()
  const orgId = membership?.organization.id ?? ''
  const firstName = user?.firstName ?? 'there'

  // Fetch the dashboard data
  const { data, isLoading, error } = useSWR<StaffDashboardData>(
    orgId ? ['staff-dashboard', orgId] : null,
    async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return getStaffDashboardData(token, orgId)
    }
  )

  if (isLoading) {
    return <DashboardLoading />
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center text-[var(--color-text-secondary)]">
        {error?.message ?? 'No data available'}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div data-walkthrough="feature-dashboard">
        <DashboardGreeting
          name={firstName}
          timeOfDay={data.greeting.timeOfDay}
        />
      </div>

      {/* ── KPI Grid: shared StatCard, per-vertical staff arrangement ── */}
      <DashboardKpiRows rows={STAFF_KPI_ROWS} data={data} />

      {/* ── Active Alerts ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">
              Active Alerts
            </h2>
          </div>
          <Link
            href="/alerts"
            className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center"
          >
            View all alerts{' '}
            <span className="ml-1 text-lg leading-none mt-0.5">›</span>
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
                  <p className="text-sm font-bold text-[var(--color-text-primary)] truncate pr-20">
                    {alert.message}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2 pr-4 leading-relaxed">
                    {alert.type === 'STAFF_ACTIVITY'
                      ? 'Staff activity logged.'
                      : 'Noticeable changes detected.'}
                  </p>
                </div>
                <div className="absolute top-4 right-4 flex flex-col items-end gap-1.5 z-10">
                  <span className="rounded bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-800">
                    {alert.type === 'STAFF_ACTIVITY'
                      ? 'Sale Logged'
                      : 'High Activity'}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-medium flex items-center gap-0.5">
                    10m ago{' '}
                    <span className="text-sm font-bold ml-1 leading-none">
                      ›
                    </span>
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
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">
              Low Stock Watch List
            </h2>
          </div>
          <Link
            href="/inventory"
            className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center"
          >
            View all items{' '}
            <span className="ml-1 text-lg leading-none mt-0.5">›</span>
          </Link>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
          {data.lowStockWatchList.length === 0 ? (
            <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">
              No low stock items.
            </div>
          ) : (
            data.lowStockWatchList.map((item, idx) => (
              <Link
                key={item.id}
                href="/inventory"
                className={`flex items-center justify-between px-4 py-3 hover:bg-[var(--color-bg-base)] transition-colors ${
                  idx !== data.lowStockWatchList.length - 1
                    ? 'border-b border-[var(--color-border)]'
                    : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <Package className="h-4 w-4 text-gray-500" />
                  </div>
                  <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-yellow-500" />
                  <span className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-sm font-bold text-orange-500">
                    {item.quantity} {item.unit}
                  </span>
                  <span className="text-[var(--color-text-muted)] text-lg leading-none">
                    ›
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* ── Smart Recommendations ───────────────────────────────────────── */}
      <section>
        {data.recommendedActions.length > 0 ? (
          <div className="flex flex-col rounded-2xl border border-[var(--hf-border-subtle)] bg-[var(--hf-status-success-surface)] p-4 relative shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--hf-accent-default)] shadow-sm">
                <Sparkles className="h-6 w-6 text-[var(--hf-accent-foreground)]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-[var(--hf-status-success)] mb-1">
                  Smart Recommendations
                </h3>
                <p className="text-sm font-bold text-[var(--color-text-primary)] leading-tight mb-1">
                  {data.recommendedActions[0].action}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] pr-2 leading-relaxed">
                  {data.recommendedActions[0].reason}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="rounded-full border border-[var(--hf-status-success)] bg-[var(--hf-bg-surface)] px-4 py-1.5 text-xs font-bold text-[var(--hf-status-success)] flex items-center gap-1 hover:bg-[var(--hf-bg-elevated)] transition-colors">
                View details <span className="text-sm leading-none">›</span>
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function RetailDashboard() {
  const { getToken } = useAuth()
  const { membership } = useMyOrganization()
  const { user } = useUser()
  const { canViewAnalytics } = useRole()
  const { preset } = useDateRange()

  const orgId = membership?.organization.id

  const fetcher = async () => {
    if (!orgId) throw new Error('No organization found')
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')
    return getDashboardData(token, orgId)
  }

  const { data, error, isLoading } = useSWR<DashboardData>(
    canViewAnalytics && orgId ? ['dashboard', orgId, preset] : null,
    fetcher
  )

  const loading = isLoading
  const firstName = user?.firstName ?? 'there'
  const timeLabel: TimeOfDay = data?.greeting.timeOfDay ?? 'morning'

  // Staff get their own dedicated dashboard
  if (!canViewAnalytics) {
    return <StaffDashboard />
  }

  if (loading) {
    return <DashboardLoading />
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center text-[var(--color-text-secondary)]">
        {error ?? 'No data available'}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Top Operations Bar */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2"
        data-walkthrough="feature-dashboard"
      >
        <DashboardGreeting
          name={firstName}
          timeOfDay={timeLabel}
          className="min-w-0 flex-1"
        />
        <TopOperationsBar
          shortcuts={[
            {
              label: '+ Record Sale',
              href: '/transactions?type=SALE',
              icon: TrendingUp,
              primary: true,
            },
            {
              label: '+ Receive Stock',
              href: '/inventory?action=receive',
              icon: Package,
            },
            {
              label: '+ Add SKU',
              href: '/inventory?action=add',
              icon: ShoppingCart,
            },
            {
              label: 'Barcode Scan',
              href: '/inventory?action=scan',
              icon: QrCode,
            },
          ]}
        />
      </div>

      {/* ── Desktop Bento Grid (lg+) ─────────────────────────────────────────── */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-5">
        {/* Row 1 */}
        <div className="lg:col-span-4 flex flex-col">
          <BentoSalesPair
            salesAmount={data.kpis.todaySales}
            purchaseAmount={data.kpis.todayExpenses}
            salesTrendPct={data.kpis.salesTrendPct}
            salesTrendLabel={data.kpis.salesTrendLabel}
            purchaseTrendPct={data.kpis.expensesTrendPct}
            purchaseTrendLabel={data.kpis.expensesTrendLabel}
            topHref="/transactions?type=SALE"
            bottomHref="/transactions?type=PURCHASE"
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGrowthCard
            title="Sales Throughput Velocity"
            currentCount={`KES ${formatKpiNumber(data.kpis.todaySales).display}`}
            currentDelta={data.kpis.salesTrendLabel}
            currentProgressPct={data.inventorySnapshot.stockHealthPct}
            footerLeftLabel="Store catalog health"
            footerRightLabel={`${data.inventorySnapshot.healthy} of ${data.inventorySnapshot.total} SKUs healthy`}
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGaugeCard
            title="Inventory Health Score"
            value={data.inventorySnapshot.stockHealthPct}
            displayValue={`${data.inventorySnapshot.stockHealthPct}%`}
            label="Healthy Stock"
            totalCapacity={100}
            increasePct={
              data.kpis.lowStockCount > 0
                ? `${data.kpis.lowStockCount} Low`
                : 'Optimal'
            }
            footerText="Catalog stock availability is"
            className="h-full"
          />
        </div>

        {/* Row 2 */}
        <div className="lg:col-span-7">
          <BentoStatisticsCard
            title="Sales Throughput & Inventory Velocity"
            tab1Label="Sales Volume"
            tab2Label="Stock Breakdown"
            headlineValue={`KES ${formatKpiNumber(data.kpis.todaySales).display}`}
            headlineSubtitle={`Net profit estimate: KES ${formatKpiNumber(data.kpis.profitEstimate).display} · ${data.kpis.salesTrendLabel} vs yesterday`}
            tab1Bars={[
              { day: 'Mon', tag: '40%', pct: 40 },
              { day: 'Tue', tag: '55%', pct: 55 },
              { day: 'Wed', tag: '70%', pct: 70 },
              { day: 'Thu', tag: '85%', pct: 85, isHighlight: true },
              { day: 'Fri', tag: '75%', pct: 75 },
              { day: 'Sat', tag: '+95%', pct: 95, isHighlight: true },
              { day: 'Sun', tag: '60%', pct: 60 },
            ]}
            tab2Bars={[
              {
                day: 'Mon',
                tag: `${data.inventorySnapshot.healthy}`,
                pct: Math.min(
                  100,
                  Math.round(
                    (data.inventorySnapshot.healthy /
                      Math.max(data.inventorySnapshot.total, 1)) *
                      100
                  )
                ),
                isHighlight: true,
              },
              {
                day: 'Tue',
                tag: `${data.inventorySnapshot.low}`,
                pct: Math.min(
                  100,
                  Math.round(
                    (data.inventorySnapshot.low /
                      Math.max(data.inventorySnapshot.total, 1)) *
                      100
                  )
                ),
              },
              {
                day: 'Wed',
                tag: `${data.inventorySnapshot.outOfStock}`,
                pct: Math.min(
                  100,
                  Math.round(
                    (data.inventorySnapshot.outOfStock /
                      Math.max(data.inventorySnapshot.total, 1)) *
                      100
                  )
                ),
              },
              {
                day: 'Thu',
                tag: `${data.inventorySnapshot.total}`,
                pct: 100,
                isHighlight: true,
              },
              {
                day: 'Fri',
                tag: `${data.inventorySnapshot.stockHealthPct}%`,
                pct: data.inventorySnapshot.stockHealthPct,
              },
              {
                day: 'Sat',
                tag: `${data.kpis.lowStockCount}`,
                pct: Math.min(100, data.kpis.lowStockCount * 10),
              },
              { day: 'Sun', tag: `${data.inventorySnapshot.healthy}`, pct: 90 },
            ]}
            className="h-full"
          />
        </div>
        <div className="lg:col-span-5">
          <BentoActivityFeed
            title="Store Alerts & Live Stream"
            orders={[
              ...data.attentionFeed.map((alert) => ({
                id: alert.id,
                name: alert.message,
                avatarText: alert.severity === 'CRITICAL' ? '!' : 'A',
                avatarColor:
                  alert.severity === 'CRITICAL'
                    ? 'bg-rose-500'
                    : 'bg-amber-500',
                description: alert.type.replace('_', ' '),
                time: 'Active',
                value: alert.severity,
                badgeText: alert.severity === 'CRITICAL' ? 'Critical' : 'Alert',
                badgeTone: (alert.severity === 'CRITICAL' ? 'sky' : 'teal') as
                  | 'sky'
                  | 'teal',
              })),
              ...(data.kpis.lowStockCount > 0
                ? [
                    {
                      id: 'low-stock-alert',
                      name: `${data.kpis.lowStockCount} items need restocking`,
                      avatarText: 'L',
                      avatarColor: 'bg-amber-500',
                      description: `${data.inventorySnapshot.low} low · ${data.inventorySnapshot.outOfStock} out of stock`,
                      time: 'Stock',
                      value: `${data.kpis.lowStockCount} Low`,
                      badgeText: 'Restock',
                      badgeTone: 'teal' as const,
                    },
                  ]
                : []),
              {
                id: 'sales-status',
                name: `Today's sales KES ${formatKpiNumber(data.kpis.todaySales).display}`,
                avatarText: 'S',
                avatarColor: 'bg-emerald-500',
                description: `${data.kpis.salesTrendLabel} vs yesterday · Profit KES ${formatKpiNumber(data.kpis.profitEstimate).display}`,
                time: 'Live',
                value: data.kpis.salesTrendLabel,
                badgeText: 'Sales',
                badgeTone: 'emerald' as const,
              },
            ]}
            className="h-full"
          />
        </div>

        {/* Row 3 — Chart spans full width on desktop */}
        <div className="lg:col-span-12">
          <ModernAnalyticsChart />
        </div>
      </div>

      {/* ── Mobile Layout (below lg) ─────────────────────────────────────────── */}
      <div className="lg:hidden flex flex-col gap-6">
        {/* Top Row: KPI Metric Cards */}
        <div className="mb-2">
          <DashboardKpiRows rows={RETAIL_KPI_ROWS} data={data} />
        </div>

        {/* Main Analytical & Operational Grid */}
        <div className="grid grid-cols-1 gap-6">
          {/* Chart */}
          <ModernAnalyticsChart />

          {/* Inventory Snapshot */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base text-[var(--color-text-primary)]">
                Inventory Snapshot
              </h2>
              <Link
                href="/inventory"
                className="text-sm text-[var(--color-accent)] font-semibold hover:underline"
              >
                View all
              </Link>
            </div>
            <DashboardKpiRows rows={RETAIL_INVENTORY_ROWS} data={data} />
          </div>

          {/* Attention Feed */}
          {data.attentionFeed.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-base text-[var(--color-text-primary)]">
                  Attention Feed
                </h2>
                <Link
                  href="/alerts"
                  className="text-sm text-[var(--color-accent)] font-semibold hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="flex flex-col gap-2.5">
                {data.attentionFeed.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 flex items-start gap-3 shadow-sm"
                  >
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                          : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-400'
                      }`}
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <p className="text-xs font-semibold text-[var(--color-text-primary)] leading-relaxed">
                      {alert.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Actions */}
          {data.recommendedActions.length > 0 && (
            <div>
              <h2 className="font-bold text-base text-[var(--color-text-primary)] mb-3">
                Recommended Actions
              </h2>
              <div className="flex flex-col gap-2.5">
                {data.recommendedActions.map((rec, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 flex items-start gap-3 shadow-sm"
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                        rec.priority === 'HIGH'
                          ? 'bg-red-500'
                          : rec.priority === 'MEDIUM'
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-[var(--color-text-primary)] leading-tight">
                        {rec.action}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 leading-relaxed">
                        {rec.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const {
    canViewAnalytics,
    isGuestHouse,
    isSchool,
    isChemist,
    isRestaurant,
    isWholesaler,
    isIsp,
  } = useRole()

  if (!canViewAnalytics) {
    return <StaffDashboard />
  }

  if (isGuestHouse) return <GuestHouseDashboard />
  if (isSchool) return <SchoolDashboard />
  if (isChemist) return <ChemistDashboard />
  if (isRestaurant) return <RestaurantDashboard />
  if (isWholesaler) return <WholesaleDashboard />
  if (isIsp) return <IspDashboard />

  return <RetailDashboard />
}
