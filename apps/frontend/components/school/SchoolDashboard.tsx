'use client'

import React from 'react'
import useSWR from 'swr'
import { useAuth, useUser } from '@clerk/nextjs'
import { useMyOrganization } from '@/hooks/useMyOrganization'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Users,
  GraduationCap,
  BookOpen,
  AlertTriangle,
  CircleDollarSign,
  Clock,
  ReceiptText,
  FilePlus,
  UserPlus,
} from 'lucide-react'
import {
  getSchoolDashboardData,
  type SchoolDashboardData,
} from '@/services/analytics.service'
import DashboardLoading from '@/app/(dashboard)/loading'
import { format } from 'date-fns'
import {
  AiRecommendationsCard,
  type Recommendation,
} from '@/components/shared/AiRecommendationsCard'
import { DashboardKpiRows } from '@/features/dashboard/DashboardKpiRows'
import { SCHOOL_KPI_ROWS } from '@/features/dashboard/config/school'
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

function buildSchoolRecommendations(
  data: SchoolDashboardData
): Recommendation[] {
  const recs: Recommendation[] = []

  if (data.activeTerm === null) {
    recs.push({
      action: 'Set up an active academic term',
      reason:
        'No term is currently active. You cannot generate invoices or collect fees without an active term.',
      priority: 'HIGH',
      href: '/school-fees',
    })
  }

  if (data.fees.collectionRate < 50 && data.fees.totalExpected > 0) {
    recs.push({
      action: `Boost fee collection (currently at ${data.fees.collectionRate}%)`,
      reason:
        'Fee collection is below 50%. Consider sending SMS reminders to parents with outstanding balances.',
      priority: 'HIGH',
      href: '/school-fees',
    })
  }

  if (data.overdueInvoices.length > 0) {
    recs.push({
      action: `Follow up on ${data.overdueInvoices.length} overdue invoice${data.overdueInvoices.length > 1 ? 's' : ''}`,
      reason: `${data.overdueInvoices
        .slice(0, 2)
        .map((i) => i.studentName)
        .join(
          ', '
        )} ${data.overdueInvoices.length > 2 ? 'and others have' : 'has'} unpaid fees.`,
      priority: 'MEDIUM',
      href: '/school-fees',
    })
  }

  if (data.totalStudents === 0) {
    recs.push({
      action: 'Add your first students',
      reason:
        'Your student roster is empty. Add students and assign them to classes to begin managing your school.',
      priority: 'LOW',
      href: '/students',
    })
  }

  return recs
}

export function SchoolDashboard() {
  const { getToken } = useAuth()
  const { user } = useUser()
  const { membership } = useMyOrganization()
  const orgId = membership?.organization.id

  const { data, error, isLoading } = useSWR<SchoolDashboardData>(
    orgId ? ['school-dashboard', orgId] : null,
    async () => {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated')
      return getSchoolDashboardData(token, orgId!)
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

  const collectionBarWidth = Math.min(data.fees.collectionRate, 100)

  const shortcuts = [
    {
      label: '+ Record Payment',
      href: '/school-fees',
      icon: CircleDollarSign,
      primary: true,
    },
    { label: '+ Add Student', href: '/students', icon: UserPlus },
    { label: '+ Add Class', href: '/school-classes', icon: BookOpen },
    { label: '+ Generate Invoices', href: '/school-fees', icon: FilePlus },
  ]

  const defaulters = data.overdueInvoices.slice(0, 3)

  const schoolTab1Bars = [
    { day: 'Mon', tag: `${data.totalStudents}`, pct: 100, isHighlight: true },
    {
      day: 'Tue',
      tag: `${data.totalClasses} cls`,
      pct: Math.min(100, data.totalClasses * 12),
    },
    {
      day: 'Wed',
      tag: `${data.fees.paidCount} paid`,
      pct: Math.min(
        100,
        Math.round(
          (data.fees.paidCount / Math.max(data.fees.totalInvoices, 1)) * 100
        )
      ),
    },
    {
      day: 'Thu',
      tag: `${data.fees.collectionRate}%`,
      pct: data.fees.collectionRate,
      isHighlight: data.fees.collectionRate >= 60,
    },
    {
      day: 'Fri',
      tag: `${data.overdueInvoices.length} due`,
      pct: Math.min(100, data.overdueInvoices.length * 15),
    },
    {
      day: 'Sat',
      tag: `${data.recentPayments.length} rcpt`,
      pct: Math.min(100, data.recentPayments.length * 20),
    },
    { day: 'Sun', tag: `${data.totalStudents}`, pct: 90 },
  ]

  const schoolTab2Bars = [
    {
      day: 'Mon',
      tag: `${data.fees.paidCount}`,
      pct: Math.min(
        100,
        Math.round(
          (data.fees.paidCount / Math.max(data.fees.totalInvoices, 1)) * 100
        )
      ),
      isHighlight: true,
    },
    {
      day: 'Tue',
      tag: `${Math.max(0, data.fees.totalInvoices - data.fees.paidCount)} unpaid`,
      pct: Math.min(
        100,
        Math.round(
          (Math.max(0, data.fees.totalInvoices - data.fees.paidCount) /
            Math.max(data.fees.totalInvoices, 1)) *
            100
        )
      ),
    },
    {
      day: 'Wed',
      tag: `${data.fees.collectionRate}%`,
      pct: data.fees.collectionRate,
    },
    {
      day: 'Thu',
      tag: `${data.fees.totalInvoices} inv`,
      pct: 100,
      isHighlight: true,
    },
    {
      day: 'Fri',
      tag: `KES ${Math.round(data.fees.totalCollected / 1000)}k`,
      pct: Math.min(
        100,
        Math.round(
          (data.fees.totalCollected / Math.max(data.fees.totalExpected, 1)) *
            100
        )
      ),
    },
    {
      day: 'Sat',
      tag: `KES ${Math.round(data.fees.outstanding / 1000)}k`,
      pct: Math.min(
        100,
        Math.round(
          (data.fees.outstanding / Math.max(data.fees.totalExpected, 1)) * 100
        )
      ),
    },
    {
      day: 'Sun',
      tag: `${data.fees.collectionRate}%`,
      pct: data.fees.collectionRate,
      isHighlight: true,
    },
  ]

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* ── Header & Top Operations Shortcuts (Always On Top on PC) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <DashboardGreeting
          name={firstName}
          timeOfDay={data.timeOfDay}
          className="min-w-0 flex-1"
        />
        <TopOperationsBar shortcuts={shortcuts} />
      </div>

      {/* ── Desktop Bento Grid (lg+) Matching Inspo 1 ── */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-5">
        {/* Row 1: col-span-4, 4, 4 */}
        <div className="lg:col-span-4">
          <BentoSalesPair
            salesAmount={data.fees.totalCollected}
            purchaseAmount={data.fees.outstanding}
            topLabel="Fees Collected"
            topIcon={CircleDollarSign}
            bottomLabel="Outstanding"
            bottomIcon={AlertTriangle}
            salesTrendPct={data.fees.collectionRate}
            salesTrendLabel={`${data.fees.collectionRate}% rate`}
            purchaseTrendPct={
              data.fees.outstanding > 0 ? -(100 - data.fees.collectionRate) : 0
            }
            purchaseTrendLabel={`${100 - data.fees.collectionRate}% unpaid`}
            topHref="/school-fees"
            bottomHref="/school-fees"
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGrowthCard
            title="Term Collection Velocity"
            currentCount={`${data.fees.collectionRate}%`}
            currentDelta={
              data.fees.collectionRate >= 50 ? '+Good' : 'Below Target'
            }
            currentProgressPct={data.fees.collectionRate}
            footerLeftLabel="Invoices paid this term"
            footerRightLabel={`${data.fees.paidCount} / ${data.fees.totalInvoices} settled`}
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGaugeCard
            title="Collection Rate"
            value={data.fees.collectionRate}
            totalCapacity={100}
            label="Collection %"
            increasePct={`${data.fees.collectionRate}%`}
            footerText="Term fee collection is"
            className="h-full"
          />
        </div>

        {/* Row 2: col-span-7, 5 */}
        <div className="lg:col-span-7">
          <BentoStatisticsCard
            title="Enrollment & Fee Statistics"
            tab1Label="Students"
            tab2Label="Fee Invoices"
            headlineValue={`${data.totalStudents} Students`}
            headlineSubtitle={`${data.totalClasses} active classes · ${data.fees.collectionRate}% fee collection rate this term`}
            tab1Bars={schoolTab1Bars}
            tab2Bars={schoolTab2Bars}
            className="h-full"
          />
        </div>
        <div className="lg:col-span-5">
          <BentoActivityFeed
            title="Fee Defaulters & Recent Payments"
            orders={[
              ...defaulters.map((inv, i) => ({
                id: `def-${i}`,
                name: inv.studentName,
                avatarText: inv.studentName.charAt(0).toUpperCase(),
                avatarColor:
                  inv.status === 'PARTIAL' ? 'bg-amber-500' : 'bg-rose-500',
                description: `${inv.termName} · Balance: KES ${inv.amountDue.toLocaleString()}`,
                time: '',
                value: `KES ${inv.amountDue.toLocaleString()}`,
                badgeText: inv.status === 'PARTIAL' ? 'Partial' : 'Unpaid',
                badgeTone: (inv.status === 'PARTIAL' ? 'teal' : 'sky') as
                  | 'teal'
                  | 'sky',
              })),
              ...data.recentPayments.slice(0, 2).map((p, i) => ({
                id: `pay-${i}`,
                name: p.studentName,
                avatarText: p.studentName.charAt(0).toUpperCase(),
                avatarColor: 'bg-emerald-500',
                description: `Paid via ${p.method}`,
                time: '',
                value: `+KES ${p.amount.toLocaleString()}`,
                badgeText: 'Paid',
                badgeTone: 'emerald' as const,
              })),
            ]}
            className="h-full"
          />
        </div>
      </div>

      {/* ── Mobile Layout (lg:hidden) ── */}
      <div className="lg:hidden flex flex-col gap-6">
        {/* Active Term Banner */}
        {data.activeTerm ? (
          <div className="flex items-center justify-between rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-500">
                  Active Term
                </p>
                <p className="text-sm font-bold text-[var(--color-text-primary)]">
                  {data.activeTerm.name}
                </p>
              </div>
            </div>
            {data.activeTerm.dueDate && (
              <div className="text-right">
                <p className="text-[10px] text-blue-400 font-semibold">
                  Fee Due Date
                </p>
                <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  {format(new Date(data.activeTerm.dueDate), 'MMM d, yyyy')}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
              No active term set.
            </p>
            <Link
              href="/school-fees"
              className="ml-auto text-xs font-bold text-yellow-700 dark:text-yellow-400 hover:underline"
            >
              Set Term →
            </Link>
          </div>
        )}

        {/* KPI Grid */}
        <DashboardKpiRows rows={SCHOOL_KPI_ROWS} data={data} />

        {/* AI Recommendations */}
        <AiRecommendationsCard
          recommendations={buildSchoolRecommendations(data)}
        />

        {/* Fee Collection Progress */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">
              Fee Collection Rate
            </h2>
            <span className="text-xs font-bold text-[var(--color-accent)]">
              {data.fees.collectionRate}%
            </span>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-2">
              <span>
                KES {data.fees.totalCollected.toLocaleString()} collected
              </span>
              <span>
                Target: KES {data.fees.totalExpected.toLocaleString()}
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${collectionBarWidth >= 80 ? 'bg-green-500' : collectionBarWidth >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${collectionBarWidth}%` }}
              />
            </div>
          </div>
        </section>

        {/* Pending Invoices */}
        {data.overdueInvoices.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm text-[var(--color-text-primary)]">
                Pending Invoices
              </h2>
              <Link
                href="/school-fees"
                className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center"
              >
                View all <span className="ml-1 text-lg leading-none">›</span>
              </Link>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
              {data.overdueInvoices.map((inv, idx) => (
                <div
                  key={inv.id}
                  className={`flex items-center justify-between px-4 py-3 ${idx !== data.overdueInvoices.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--color-text-primary)]">
                        {inv.studentName}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {inv.termName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      KES {inv.amountDue.toLocaleString()}
                    </p>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${inv.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}
                    >
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Payments */}
        {data.recentPayments.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm text-[var(--color-text-primary)]">
                Recent Payments
              </h2>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
              {data.recentPayments.map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-4 py-3 ${idx !== data.recentPayments.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center shrink-0">
                      <CircleDollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--color-text-primary)]">
                        {p.studentName}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {p.method}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-green-600 dark:text-green-400">
                    +KES {p.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Shared (visible on all breakpoints below lg) ── */}
      {/* Active Term Banner — desktop variant (shown alongside Bento grid) */}
      <div className="hidden lg:flex items-center justify-between rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <div>
            {data.activeTerm ? (
              <>
                <p className="text-xs font-semibold text-blue-500">
                  Active Term
                </p>
                <p className="text-sm font-bold text-[var(--color-text-primary)]">
                  {data.activeTerm.name}
                </p>
              </>
            ) : (
              <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
                No active term —{' '}
                <Link href="/school-fees" className="underline">
                  set one now
                </Link>
              </p>
            )}
          </div>
        </div>
        {data.activeTerm?.dueDate && (
          <div className="text-right">
            <p className="text-[10px] text-blue-400 font-semibold">
              Fee Due Date
            </p>
            <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
              {format(new Date(data.activeTerm.dueDate), 'MMM d, yyyy')}
            </p>
          </div>
        )}
        <Link
          href="/school-fees"
          className="ml-auto text-xs font-bold text-[var(--color-accent)] hover:underline flex items-center gap-1"
        >
          <ReceiptText className="h-3.5 w-3.5" /> Manage Fees
        </Link>
      </div>

      {/* AI Recommendations — desktop variant (below bento grid) */}
      <div className="hidden lg:block">
        <AiRecommendationsCard
          recommendations={buildSchoolRecommendations(data)}
        />
      </div>

      {/* Quick Actions — mobile only */}
      <div className="grid grid-cols-3 gap-3 lg:hidden">
        <Link
          href="/students"
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[var(--color-primary)] text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          <Users className="h-6 w-6 mb-2" />
          <span className="text-xs font-bold text-center leading-tight">
            Students
          </span>
        </Link>
        <Link
          href="/school-classes"
          className="flex flex-col items-center justify-center p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-elevated)] transition-colors"
        >
          <BookOpen className="h-6 w-6 mb-2 text-[var(--color-primary)]" />
          <span className="text-xs font-bold text-center leading-tight text-[var(--color-text-primary)]">
            Classes
          </span>
        </Link>
        <Link
          href="/school-fees"
          className="flex flex-col items-center justify-center p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-elevated)] transition-colors"
        >
          <ReceiptText className="h-6 w-6 mb-2 text-[var(--color-primary)]" />
          <span className="text-xs font-bold text-center leading-tight text-[var(--color-text-primary)]">
            Fees
          </span>
        </Link>
      </div>
    </div>
  )
}
