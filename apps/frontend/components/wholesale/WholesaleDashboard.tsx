'use client'

import useSWR from 'swr'
import { useAuth, useUser } from '@clerk/nextjs'
import { useMyOrganization } from '@/hooks/useMyOrganization'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Package,
  Banknote,
  Users,
  Zap,
  Plus,
  ShoppingCart,
} from 'lucide-react'
import {
  getWholesaleDashboardData,
  type WholesaleDashboardData,
} from '@/services/analytics.service'
import DashboardLoading from '@/app/(dashboard)/loading'
import { DashboardKpiRows } from '@/features/dashboard/DashboardKpiRows'
import { WHOLESALE_KPI_ROWS } from '@/features/dashboard/config/wholesale'
import { TopOperationsBar } from '@/components/dashboard/TopOperationsBar'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'

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

export function WholesaleDashboard() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { membership } = useMyOrganization()
  const orgId = membership?.organization.id

  const { data, error, isLoading } = useSWR<WholesaleDashboardData>(
    orgId ? ['wholesale-dashboard', orgId] : null,
    async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return getWholesaleDashboardData(token, orgId!)
    }
  )

  if (isLoading) return <DashboardLoading />
  if (error || !data) {
    return (
      <div className="py-12 text-center text-[var(--color-text-secondary)]">
        {error?.message ?? 'No data available'}
      </div>
    )
  }

  const firstName = user?.firstName ?? 'there'

  const shortcuts = [
    {
      label: '+ Record Bulk Sale',
      href: '/transactions?type=SALE',
      icon: ShoppingCart,
      primary: true,
    },
    { label: '+ Receive Stock', href: '/inventory', icon: Plus },
    { label: '+ Warehouse SKUs', href: '/inventory', icon: Package },
    { label: 'Debtor Accounts', href: '/finance', icon: Banknote },
  ]

  const todayDelta =
    data.todaySalesComparison?.deltaPct != null
      ? `${data.todaySalesComparison.deltaPct >= 0 ? '+' : ''}${data.todaySalesComparison.deltaPct}%`
      : '—'
  const monthDelta =
    data.monthSalesComparison?.deltaPct != null
      ? `${data.monthSalesComparison.deltaPct >= 0 ? '+' : ''}${data.monthSalesComparison.deltaPct}%`
      : '—'

  const wholesaleTab1Bars = (() => {
    const series = data.dailySeries?.sales
    if (!series || series.length === 0) return undefined
    const max = Math.max(...series.map((s) => s.value), 0)
    return series.map((s) => ({
      day: s.label,
      tag: s.value > 0 ? `KES ${Math.round(s.value / 1000)}k` : '—',
      pct: max > 0 ? Math.round((s.value / max) * 100) : 0,
      isHighlight: max > 0 && s.value === max,
    }))
  })()

  const healthySkus = Math.max(0, data.totalItems - data.lowStockCount)
  const totalItems = Math.max(data.totalItems, 1)
  const wholesaleTab2Bars = [
    {
      day: 'Mon',
      tag: `${healthySkus} ok`,
      pct: data.totalItems > 0 ? Math.round((healthySkus / totalItems) * 100) : 0,
      isHighlight: true,
    },
    {
      day: 'Tue',
      tag: `${data.lowStockCount} low`,
      pct:
        data.totalItems > 0
          ? Math.min(100, Math.round((data.lowStockCount / totalItems) * 100))
          : 0,
    },
    {
      day: 'Wed',
      tag: `${data.openCreditCount} credit`,
      pct:
        data.openCreditCount > 0
          ? Math.min(100, data.openCreditCount * 10)
          : 0,
    },
    {
      day: 'Thu',
      tag: `${data.totalItems} SKUs`,
      pct: data.totalItems > 0 ? 100 : 0,
      isHighlight: data.totalItems > 0,
    },
    {
      day: 'Fri',
      tag:
        data.totalOutstanding > 0
          ? `KES ${Math.round(data.totalOutstanding / 1000)}k`
          : 'Cleared',
      pct:
        data.monthSales > 0
          ? Math.min(
              100,
              Math.round((data.totalOutstanding / data.monthSales) * 100)
            )
          : 0,
    },
    {
      day: 'Sat',
      tag: `${data.topSellers.length} sellers`,
      pct:
        data.totalItems > 0
          ? Math.min(
              100,
              Math.round((data.topSellers.length / totalItems) * 100)
            )
          : 0,
    },
    {
      day: 'Sun',
      tag: data.todaySales > 0 ? `KES ${Math.round(data.todaySales / 1000)}k` : '—',
      pct:
        data.monthSales > 0
          ? Math.min(100, Math.round((data.todaySales / data.monthSales) * 100))
          : 0,
      isHighlight: data.todaySales > 0,
    },
  ]

  const wholesaleActivityOrders = [
    ...data.alerts.slice(0, 2).map((alt) => ({
      id: `alt-${alt.id}`,
      name: alt.message,
      avatarText: '!',
      avatarColor: alt.severity === 'CRITICAL' ? 'bg-rose-500' : 'bg-amber-500',
      description: `Warehouse alert · ${alt.severity.toLowerCase()}`,
      time: 'Now',
      value: alt.severity,
      badgeText: 'Alert',
      badgeTone: (alt.severity === 'CRITICAL' ? 'indigo' : 'teal') as
        | 'indigo'
        | 'teal',
    })),
    ...data.topDebtors.slice(0, 2).map((debtor) => ({
      id: `debt-${debtor.id}`,
      name: debtor.clientName,
      avatarText: debtor.clientName.charAt(0).toUpperCase(),
      avatarColor: debtor.status === 'OVERDUE' ? 'bg-rose-500' : 'bg-amber-500',
      description: `${debtor.status} account · Payment follow-up needed`,
      time: 'Credit',
      value: `KES ${debtor.amountOwed.toLocaleString()}`,
      badgeText: debtor.status === 'PARTIAL' ? 'Partial' : 'Debtor',
      badgeTone: (debtor.status === 'PARTIAL' ? 'teal' : 'sky') as
        | 'teal'
        | 'sky',
    })),
    ...data.topSellers.slice(0, 2).map((seller) => ({
      id: `seller-${seller.itemId}`,
      name: seller.name,
      avatarText: seller.name.charAt(0).toUpperCase(),
      avatarColor: 'bg-emerald-500',
      description: `${seller.totalSold} ${seller.unit} dispatched (7 days)`,
      time: 'Fast-Moving',
      value: `${seller.totalSold} ${seller.unit}`,
      badgeText: 'Top SKU',
      badgeTone: 'emerald' as const,
    })),
  ]

  const finalWholesaleActivity =
    wholesaleActivityOrders.length > 0
      ? wholesaleActivityOrders
      : [
          {
            id: 'wh-healthy',
            name: 'Warehouse Operations Synchronized',
            avatarText: '✓',
            avatarColor: 'bg-emerald-500',
            description: `${data.totalItems} total active SKUs · ${data.openCreditCount} credit accounts`,
            time: 'Live',
            value: `KES ${data.todaySales.toLocaleString()}`,
            badgeText: 'Optimal',
            badgeTone: 'emerald' as const,
          },
        ]

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* ── Header & Top Operations Shortcuts (Always on top for PC) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <DashboardGreeting
          name={firstName}
          timeOfDay={data.timeOfDay}
          className="min-w-0 flex-1"
        />
        <TopOperationsBar shortcuts={shortcuts} />
      </div>

      {/* Outstanding Credit Banner */}
      {data.totalOutstanding > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 shadow-sm">
          <div className="h-9 w-9 rounded-full bg-red-500 flex items-center justify-center shrink-0">
            <Banknote className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700">
              KES {data.totalOutstanding.toLocaleString()} in outstanding credit
            </p>
            <p className="text-xs text-red-500">
              {data.openCreditCount} open credit account
              {data.openCreditCount !== 1 ? 's' : ''}
            </p>
          </div>
          <Link
            href="/finance"
            className="text-xs font-bold text-red-600 hover:underline shrink-0"
          >
            Collect →
          </Link>
        </div>
      )}

      {/* ── Desktop Bento Grid (lg+) Matching Inspo 1 ── */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-5">
        {/* Row 1 */}
        <div className="lg:col-span-4 flex flex-col">
          <BentoSalesPair
            salesAmount={data.todaySales}
            purchaseAmount={data.monthSales}
            topLabel="Today's Bulk Sales"
            topIcon={ShoppingCart}
            bottomLabel="Month Sales"
            bottomIcon={Package}
            salesTrendPct={data.todaySalesComparison?.deltaPct ?? undefined}
            salesTrendLabel={todayDelta}
            purchaseTrendPct={data.monthSalesComparison?.deltaPct ?? undefined}
            purchaseTrendLabel={monthDelta}
            topHref="/transactions"
            bottomHref="/transactions"
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGrowthCard
            title="Warehouse Velocity"
            currentCount={`${data.totalItems} SKUs`}
            currentDelta={todayDelta}
            currentProgressPct={
              data.totalItems > 0
                ? Math.min(
                    100,
                    Math.round((healthySkus / totalItems) * 100)
                  )
                : 0
            }
            footerLeftLabel="Active catalog distribution"
            footerRightLabel={
              data.todaySales > 0
                ? `KES ${data.todaySales.toLocaleString()} today`
                : 'No sales today'
            }
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGaugeCard
            title="Warehouse Stock Health"
            value={Math.max(0, data.totalItems - data.lowStockCount)}
            totalCapacity={data.totalItems || 300}
            label="Healthy SKUs"
            increasePct={
              data.lowStockCount === 0
                ? '100% Stocked'
                : `${data.lowStockCount} Low`
            }
            footerText="Distribution center stock status is"
            className="h-full"
          />
        </div>

        {/* Row 2 */}
        <div className="lg:col-span-7">
          <BentoStatisticsCard
            title="Wholesale Revenue & Volume Statistics"
            tab1Label="Bulk Orders"
            tab2Label="Freight Volume"
            headlineValue={`KES ${data.todaySales.toLocaleString()}`}
            headlineSubtitle={`Month sales KES ${data.monthSales.toLocaleString()} · ${data.openCreditCount} open credit accounts (KES ${data.totalOutstanding.toLocaleString()} outstanding)`}
            tab1Bars={wholesaleTab1Bars}
            tab2Bars={wholesaleTab2Bars}
            className="h-full"
          />
        </div>
        <div className="lg:col-span-5">
          <BentoActivityFeed
            title="Large Customer Shipments & Accounts"
            orders={finalWholesaleActivity}
            className="h-full"
          />
        </div>
      </div>

      {/* ── Mobile Layout (lg:hidden) ── */}
      <div className="lg:hidden flex flex-col gap-6">
        <DashboardKpiRows rows={WHOLESALE_KPI_ROWS} data={data} />
      </div>

      {/* Top Debtors */}
      {data.topDebtors.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">
              Top Outstanding Accounts
            </h2>
            <Link
              href="/finance"
              className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center"
            >
              View all <span className="ml-1 text-lg leading-none">›</span>
            </Link>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden shadow-sm">
            {data.topDebtors.map((debtor, idx) => (
              <div
                key={debtor.id}
                className={`flex items-center justify-between px-4 py-3 ${idx !== data.topDebtors.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">
                      {debtor.clientName}
                    </p>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${debtor.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {debtor.status}
                    </span>
                  </div>
                </div>
                <p className="text-sm font-bold text-red-600">
                  KES {debtor.amountOwed.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Sellers */}
      {data.topSellers.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">
              Top Selling Products (7 days)
            </h2>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden shadow-sm">
            {data.topSellers.map((item, idx) => (
              <div
                key={item.itemId}
                className={`flex items-center justify-between px-4 py-3 ${idx !== data.topSellers.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-[var(--color-text-muted)] w-4">
                    #{idx + 1}
                  </span>
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <Zap className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">
                    {item.name}
                  </p>
                </div>
                <span className="text-sm font-bold text-green-600">
                  {item.totalSold} {item.unit}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
