'use client'

import useSWR from 'swr'
import { useAuth, useUser } from '@clerk/nextjs'
import { useMyOrganization } from '@/hooks/useMyOrganization'
import Link from 'next/link'
import {
  AlertTriangle,
  Package,
  Plus,
  Pill,
  CalendarX,
  ShoppingCart,
  Zap,
  ArrowUpRight,
  ReceiptText,
  Clock,
} from 'lucide-react'
import {
  getChemistDashboardData,
  type ChemistDashboardData,
} from '@/services/analytics.service'
import DashboardLoading from '@/app/(dashboard)/loading'
import dynamic from 'next/dynamic'
import { format } from 'date-fns'
import {
  AiRecommendationsCard,
  type Recommendation,
} from '@/components/shared/AiRecommendationsCard'
import { DashboardKpiRows } from '@/features/dashboard/DashboardKpiRows'
import { CHEMIST_KPI_ROWS } from '@/features/dashboard/config/chemist'
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

// Derive contextual AI recommendations from chemist data
function buildChemistRecommendations(
  data: ChemistDashboardData
): Recommendation[] {
  const recs: Recommendation[] = []

  if (data.expiredBatches.length > 0) {
    recs.push({
      action: `Remove ${data.expiredBatches.length} expired batch${data.expiredBatches.length > 1 ? 'es' : ''} from shelves`,
      reason: `${data.expiredBatches
        .slice(0, 2)
        .map((b) => b.productName)
        .join(
          ', '
        )} ${data.expiredBatches.length > 2 ? 'and others are' : 'is'} expired. Dispensing expired stock is a legal and safety risk.`,
      priority: 'HIGH',
      href: '/inventory',
    })
  }

  if (data.expiringBatches.length > 0) {
    const soonest = data.expiringBatches[0]
    recs.push({
      action: `Prioritise dispensing ${soonest.productName} first`,
      reason: `${soonest.quantity} units expire in ${soonest.daysLeft} days. Selling soon-to-expire items first reduces write-offs.`,
      priority: 'MEDIUM',
      href: '/inventory',
    })
  }

  if (data.lowStockCount > 0) {
    recs.push({
      action: `Restock ${data.lowStockCount} low-stock medication${data.lowStockCount > 1 ? 's' : ''}`,
      reason:
        'Running out of key stock can disrupt patient care and lose sales. Place purchase orders today.',
      priority: data.lowStockCount > 5 ? 'HIGH' : 'MEDIUM',
      href: '/inventory',
    })
  }

  if (data.topSellers.length > 0) {
    const top = data.topSellers[0]
    recs.push({
      action: `Ensure ${top.name} is always in stock`,
      reason: `It's your #1 dispensed item this week (${top.totalSold} ${top.unit}). A stockout would directly impact revenue.`,
      priority: 'LOW',
      href: '/inventory',
    })
  }

  if (data.todaySales === 0) {
    recs.push({
      action:
        'No sales recorded today — check if transactions are being logged',
      reason:
        'If the pharmacy is open, sales should appear here. Verify your staff are recording each dispensing.',
      priority: 'MEDIUM',
      href: '/transactions',
    })
  }

  return recs
}

export function ChemistDashboard() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { membership } = useMyOrganization()
  const orgId = membership?.organization.id

  const { data, error, isLoading } = useSWR<ChemistDashboardData>(
    orgId ? ['chemist-dashboard', orgId] : null,
    async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return getChemistDashboardData(token, orgId!)
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
  const recommendations = buildChemistRecommendations(data)

  const shortcuts = [
    {
      label: '+ Record Sale',
      href: '/transactions?type=SALE',
      icon: ShoppingCart,
      primary: true,
    },
    { label: '+ Receive Batch', href: '/inventory', icon: Plus },
    { label: '+ Medication Stock', href: '/inventory', icon: Pill },
    { label: 'View Receipts', href: '/transactions', icon: ReceiptText },
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

      {/* Urgent Expired Banner */}
      {data.expiredBatches.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
          <div className="h-9 w-9 rounded-full bg-red-500 flex items-center justify-center shrink-0">
            <CalendarX className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-700">
              {data.expiredBatches.length} batch
              {data.expiredBatches.length > 1 ? 'es' : ''} have expired
            </p>
            <p className="text-xs text-red-500 truncate">
              {data.expiredBatches
                .slice(0, 2)
                .map((b) => b.productName)
                .join(', ')}
              {data.expiredBatches.length > 2 ? '...' : ''}
            </p>
          </div>
          <Link
            href="/inventory"
            className="text-xs font-bold text-red-600 hover:underline shrink-0"
          >
            View →
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
            topLabel="Today's Dispensed"
            topIcon={ShoppingCart}
            bottomLabel="Month Sales"
            bottomIcon={Pill}
            salesTrendPct={18}
            salesTrendLabel="+18%"
            purchaseTrendPct={24}
            purchaseTrendLabel="+24%"
            topHref="/transactions"
            bottomHref="/transactions"
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGrowthCard
            title="Dispensing Velocity"
            currentCount={`${data.totalItems} SKUs`}
            currentDelta="+18%"
            currentProgressPct={Math.min(data.totalItems * 2, 94)}
            footerLeftLabel="Active medications in stock"
            footerRightLabel="KES 12,500 dispensed today"
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGaugeCard
            title="Stock Availability"
            value={Math.max(0, data.totalItems - data.lowStockCount)}
            totalCapacity={data.totalItems || 60}
            label="In-Stock Medications"
            increasePct={
              data.lowStockCount === 0 ? 'Optimal' : `${data.lowStockCount} Low`
            }
            footerText="Pharmacy catalog availability is"
            className="h-full"
          />
        </div>

        {/* Row 2 */}
        <div className="lg:col-span-7">
          <BentoStatisticsCard
            title="Dispensing & Pharmacy Flow Statistics"
            tab1Label="Medication Velocity"
            tab2Label="Stock Breakdown"
            headlineValue={
              data.todaySales > 0
                ? `KES ${data.todaySales.toLocaleString()}`
                : `${data.totalItems} SKUs`
            }
            headlineSubtitle={`${data.lowStockCount} medications low in stock · ${data.expiringBatches.length} batches expiring soon`}
            tab1Bars={[
              { day: 'Mon', tag: '35%', pct: 35 },
              { day: 'Tue', tag: '50%', pct: 50 },
              { day: 'Wed', tag: '68%', pct: 68 },
              { day: 'Thu', tag: '82%', pct: 82, isHighlight: true },
              { day: 'Fri', tag: '74%', pct: 74 },
              { day: 'Sat', tag: '+92%', pct: 92, isHighlight: true },
              { day: 'Sun', tag: '45%', pct: 45 },
            ]}
            tab2Bars={[
              {
                day: 'Mon',
                tag: `${Math.max(0, data.totalItems - data.lowStockCount)}`,
                pct: 85,
                isHighlight: true,
              },
              {
                day: 'Tue',
                tag: `${data.lowStockCount}`,
                pct: Math.min(100, data.lowStockCount * 15),
              },
              {
                day: 'Wed',
                tag: `${data.expiringBatches.length}`,
                pct: Math.min(100, data.expiringBatches.length * 20),
              },
              {
                day: 'Thu',
                tag: `${data.expiredBatches.length}`,
                pct: Math.min(100, data.expiredBatches.length * 25),
              },
              {
                day: 'Fri',
                tag: `${data.totalItems}`,
                pct: 100,
                isHighlight: true,
              },
              { day: 'Sat', tag: `${data.topSellers.length}`, pct: 60 },
              { day: 'Sun', tag: 'Optimal', pct: 80 },
            ]}
            className="h-full"
          />
        </div>
        <div className="lg:col-span-5">
          <BentoActivityFeed
            title="Live Medication & Batch Movements"
            orders={[
              ...data.expiredBatches.slice(0, 2).map((b) => ({
                id: `exp-${b.id}`,
                name: `${b.productName} expired!`,
                avatarText: b.productName.charAt(0).toUpperCase(),
                avatarColor: 'bg-rose-500',
                description: `Batch expired · ${b.quantity} units to retire`,
                time: 'Expired',
                value: `${b.quantity} units`,
                badgeText: 'Expired',
                badgeTone: 'sky' as const,
              })),
              ...data.expiringBatches.slice(0, 2).map((b) => ({
                id: `near-${b.id}`,
                name: `${b.productName} near expiry`,
                avatarText: b.productName.charAt(0).toUpperCase(),
                avatarColor: 'bg-amber-500',
                description: `Expires in ${b.daysLeft} days · ${b.quantity} units remaining`,
                time: `${b.daysLeft}d left`,
                value: `${b.quantity} units`,
                badgeText: 'Expiring',
                badgeTone: 'teal' as const,
              })),
              ...data.topSellers.slice(0, 2).map((s) => ({
                id: `top-${s.itemId}`,
                name: `${s.name} dispensed`,
                avatarText: s.name.charAt(0).toUpperCase(),
                avatarColor: 'bg-emerald-500',
                description: `High demand · ${s.totalSold} ${s.unit} total dispensed`,
                time: 'Top Item',
                value: `${s.totalSold} sold`,
                badgeText: 'Dispensed',
                badgeTone: 'emerald' as const,
              })),
              ...(data.expiredBatches.length === 0 &&
              data.expiringBatches.length === 0 &&
              data.topSellers.length === 0
                ? [
                    {
                      id: 'chem-status',
                      name: `${data.totalItems} pharmacy medications catalogued`,
                      avatarText: 'Rx',
                      avatarColor: 'bg-emerald-500',
                      description: `${data.lowStockCount} items below threshold · batches in good order`,
                      time: 'Live',
                      value: `KES ${data.todaySales.toLocaleString()}`,
                      badgeText: 'In Stock',
                      badgeTone: 'emerald' as const,
                    },
                  ]
                : []),
            ]}
            className="h-full"
          />
        </div>
      </div>

      {/* ── Mobile Layout (lg:hidden) ── */}
      <div className="lg:hidden flex flex-col gap-6">
        <DashboardKpiRows rows={CHEMIST_KPI_ROWS} data={data} />
      </div>

      {/* AI Recommendations */}
      <AiRecommendationsCard recommendations={recommendations} />

      {/* Active Alerts */}
      {data.alerts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">
              Active Alerts
            </h2>
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
                    alert.severity === 'CRITICAL'
                      ? 'text-red-600'
                      : 'text-yellow-600'
                  }`}
                />
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {alert.message}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Expiring Soon */}
      {data.expiringBatches.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">
              Expiring in 30–90 Days
            </h2>
            <Link
              href="/inventory"
              className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center gap-0.5"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50/30 overflow-hidden">
            {data.expiringBatches.slice(0, 5).map((b, idx) => (
              <div
                key={b.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  idx !== Math.min(data.expiringBatches.length, 5) - 1
                    ? 'border-b border-orange-100'
                    : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                    <CalendarX className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">
                      {b.productName}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Qty: {b.quantity} · Expires{' '}
                      {format(new Date(b.expiryDate), 'MMM d, yyyy')}
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
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">
              Top Dispensed (7 days)
            </h2>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
            {data.topSellers.map((item, idx) => (
              <div
                key={item.itemId}
                className={`flex items-center justify-between px-4 py-3 ${
                  idx !== data.topSellers.length - 1
                    ? 'border-b border-[var(--color-border)]'
                    : ''
                }`}
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
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-green-600">
                    {item.totalSold}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {item.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Finance Snapshot */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm text-[var(--color-text-primary)]">
            Finance Snapshot
          </h2>
          <Link
            href="/finance"
            className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center gap-0.5"
          >
            Full report <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] divide-y divide-[var(--color-border)]">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-[var(--color-text-secondary)]" />
              <span className="text-sm text-[var(--color-text-primary)]">
                Today&apos;s Revenue
              </span>
            </div>
            <span className="text-sm font-bold text-green-600">
              KES {data.todaySales.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Package className="h-4 w-4 text-[var(--color-text-secondary)]" />
              <span className="text-sm text-[var(--color-text-primary)]">
                Month Revenue
              </span>
            </div>
            <span className="text-sm font-bold text-blue-600">
              KES {data.monthSales.toLocaleString()}
            </span>
          </div>
          <Link
            href="/transactions"
            className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-bg-base)] transition-colors"
          >
            <div className="flex items-center gap-3">
              <ReceiptText className="h-4 w-4 text-[var(--color-text-secondary)]" />
              <span className="text-sm text-[var(--color-text-primary)]">
                All Transactions
              </span>
            </div>
            <ArrowUpRight className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </Link>
        </div>
      </section>
    </div>
  )
}
