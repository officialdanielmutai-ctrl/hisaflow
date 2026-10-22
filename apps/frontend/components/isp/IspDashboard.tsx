'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuth, useUser } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Wifi,
  Wrench,
  Headphones,
  Plus,
  ArrowUpRight,
  CircleDollarSign,
  Users,
  Sparkles,
} from 'lucide-react';
import { getIspDashboard, type IspDashboardData } from '@/services/isp.service';
import DashboardLoading from '@/app/(dashboard)/loading';
import { DashboardKpiRows } from '@/features/dashboard/DashboardKpiRows';
import { ISP_KPI_ROWS } from '@/features/dashboard/config/isp';
import { TopOperationsBar } from '@/components/dashboard/TopOperationsBar';

const BentoSalesPair = dynamic(() => import('@/components/dashboard/bento/BentoSalesPair'), { ssr: false });
const BentoGrowthCard = dynamic(() => import('@/components/dashboard/bento/BentoGrowthCard'), { ssr: false });
const BentoGaugeCard = dynamic(() => import('@/components/dashboard/bento/BentoGaugeCard'), { ssr: false });
const BentoStatisticsCard = dynamic(() => import('@/components/dashboard/bento/BentoStatisticsCard'), { ssr: false });
const BentoActivityFeed = dynamic(() => import('@/components/dashboard/bento/BentoActivityFeed'), { ssr: false });

export interface IspRecommendation {
  action: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  href?: string;
}

function buildIspRecommendations(data: IspDashboardData): IspRecommendation[] {
  const recs: IspRecommendation[] = [];

  // 1. Critical Support & Service SLA
  if (data.openTickets > 0) {
    recs.push({
      action: `Resolve ${data.openTickets} open support ticket${data.openTickets > 1 ? 's' : ''}`,
      reason: 'Open complaints increase subscriber churn. Assign technicians or troubleshoot connection issues promptly.',
      priority: 'HIGH',
      href: '/tickets',
    });
  }

  // 2. Overdue Revenue Collection
  if (data.subscribers.suspended > 0) {
    recs.push({
      action: `Follow up on ${data.subscribers.suspended} suspended subscriber${data.subscribers.suspended > 1 ? 's' : ''}`,
      reason: 'Suspended subscribers represent overdue recurring revenue. Follow up via WhatsApp or call to collect payment.',
      priority: 'HIGH',
      href: '/subscribers?filter=SUSPENDED',
    });
  }

  // 3. Field Deployments
  if (data.scheduledWorkOrders > 0) {
    recs.push({
      action: `Complete ${data.scheduledWorkOrders} scheduled work order${data.scheduledWorkOrders > 1 ? 's' : ''}`,
      reason: 'Ensure field technicians have issued necessary routers and drop cables to finalize installations on time.',
      priority: 'MEDIUM',
      href: '/work-orders',
    });
  }

  // 4. Subscriber Growth & Plan Upselling
  if (data.subscribers.total === 0) {
    recs.push({
      action: 'Register your first internet subscriber',
      reason: 'Your subscriber fleet is currently empty. Add subscribers and assign them to service plans to begin tracking revenue.',
      priority: 'HIGH',
      href: '/subscribers?action=add',
    });
  } else if (data.subscribers.activeRate >= 70) {
    recs.push({
      action: 'Introduce higher-speed bandwidth tiers to boost ARPU',
      reason: `Fleet retention is healthy with ${data.subscribers.activeRate}% active subscribers. Introduce premium tiers (e.g. 20Mbps / 50Mbps) to grow recurring revenue.`,
      priority: 'LOW',
      href: '/service-plans',
    });
  }

  // 5. Billing Cycle & Hardware Audits (always available)
  recs.push({
    action: 'Automate renewal notices 3 days before billing cycle ends',
    reason: 'Advance notification prevents abrupt subscriber disconnection and maintains steady cash flow.',
    priority: 'MEDIUM',
    href: '/finance',
  });

  recs.push({
    action: 'Audit field hardware inventory',
    reason: 'Verify stock levels for optical network units (ONUs), Wi-Fi routers, and drop cables before new installations.',
    priority: 'LOW',
    href: '/inventory',
  });

  return recs;
}



export function IspDashboard() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const { user } = useUser();
  const orgId = membership?.organization?.id;

  const fetcher = async () => {
    if (!orgId) throw new Error('No organization found');
    const token = await getToken();
    if (!token) throw new Error('Not authenticated');
    return getIspDashboard(token, orgId);
  };

  const { data, error, isLoading } = useSWR<IspDashboardData>(
    orgId ? ['isp-dashboard', orgId] : null,
    fetcher,
    { refreshInterval: 30000 },
  );

  if (isLoading) return <DashboardLoading />;

  if (error || !data) {
    return (
      <div className="py-12 text-center text-[var(--color-text-secondary)]">
        {error?.message ?? 'No data available'}
      </div>
    );
  }

  const firstName = user?.firstName ?? 'there';
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const greetingEmoji = timeOfDay === 'morning' ? '👋' : timeOfDay === 'afternoon' ? '☀️' : '🌙';

  const recommendations = buildIspRecommendations(data);
  const topRec = recommendations[0];
  const otherRecs = recommendations.slice(1, 4);

  const totalSubs = data.subscribers.total || 0;
  const activePct = totalSubs > 0 ? Math.round((data.subscribers.active / totalSubs) * 100) : 0;
  const suspendedPct = totalSubs > 0 ? Math.round((data.subscribers.suspended / totalSubs) * 100) : 0;
  const churnedPct = totalSubs > 0 ? Math.round((data.subscribers.churned / totalSubs) * 100) : 0;

  const shortcuts = [
    { label: '+ Add Subscriber', href: '/subscribers?action=add', icon: Plus, primary: true },
    { label: '+ New Work Order', href: '/work-orders', icon: Wrench },
    { label: '+ New Ticket', href: '/tickets', icon: Headphones },
    { label: 'Service Plans', href: '/service-plans', icon: Wifi },
  ];

  const ispTab1Bars = [
    { day: 'Mon', tag: `${data.subscribers.active} on`, pct: activePct, isHighlight: true },
    { day: 'Tue', tag: `${data.subscribers.suspended} susp`, pct: suspendedPct },
    { day: 'Wed', tag: `${data.subscribers.churned} off`, pct: churnedPct },
    { day: 'Thu', tag: `${totalSubs} fleet`, pct: 100, isHighlight: true },
    { day: 'Fri', tag: `${data.scheduledWorkOrders} jobs`, pct: Math.min(100, data.scheduledWorkOrders * 15) },
    { day: 'Sat', tag: `${data.openTickets} tix`, pct: Math.min(100, data.openTickets * 20) },
    { day: 'Sun', tag: `${data.subscribers.active}`, pct: activePct, isHighlight: true },
  ];

  const ispTab2Bars = [
    { day: 'Mon', tag: `${activePct}%`, pct: activePct, isHighlight: true },
    { day: 'Tue', tag: `${suspendedPct}%`, pct: suspendedPct },
    { day: 'Wed', tag: `KES ${Math.round(data.monthlyRevenue / 1000)}k`, pct: 85, isHighlight: true },
    { day: 'Thu', tag: `${totalSubs}`, pct: 100, isHighlight: true },
    { day: 'Fri', tag: `${data.scheduledWorkOrders}`, pct: Math.min(100, data.scheduledWorkOrders * 20) },
    { day: 'Sat', tag: `${data.openTickets}`, pct: Math.min(100, data.openTickets * 20) },
    { day: 'Sun', tag: `${activePct}%`, pct: activePct },
  ];

  return (
    <div className="w-full flex flex-col gap-6 pb-24">
      {/* ── Header & Top Operations Bar ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2 text-[var(--color-text-primary)]">
            Good {timeOfDay}, {firstName} {greetingEmoji}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              ISP Operations Center
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {membership?.organization?.name}
            </span>
          </div>
        </div>
        <TopOperationsBar shortcuts={shortcuts} />
      </div>

      {/* ── Desktop Bento Grid (lg+) Matching Inspo 1 ─────────────────────────── */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-5">
        {/* Row 1: MRR / New Subs pair, Bandwidth Growth, Fleet Health speedometer */}
        <div className="lg:col-span-4">
          <BentoSalesPair
            salesAmount={data.monthlyRevenue}
            purchaseAmount={data.subscribers.active}
            topLabel="Monthly Revenue (MRR)"
            topIcon={CircleDollarSign}
            topUnit="KES"
            bottomLabel="Active Subscribers"
            bottomIcon={Users}
            bottomUnit=""
            salesTrendPct={21}
            salesTrendLabel="+21%"
            purchaseTrendPct={activePct >= 70 ? 12 : -5}
            purchaseTrendLabel={activePct >= 70 ? `+12% fleet` : `${activePct}% online`}
            topHref="/finance"
            bottomHref="/subscribers"
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGrowthCard
            title="Subscriber Growth Velocity"
            currentCount={`${data.subscribers.total}`}
            currentDelta={activePct >= 70 ? `+Healthy` : 'Needs Attention'}
            currentProgressPct={activePct}
            footerLeftLabel="Fleet health score"
            footerRightLabel={`${data.subscribers.active} active / ${totalSubs} total`}
            className="h-full"
          />
        </div>
        <div className="lg:col-span-4">
          <BentoGaugeCard
            title="Fleet Health Speedometer"
            value={data.subscribers.active}
            totalCapacity={Math.max(totalSubs, 1)}
            label="Active Subs"
            increasePct={`${activePct}%`}
            footerText="Subscriber fleet health is"
            className="h-full"
          />
        </div>

        {/* Row 2: Statistics capsule bars + Recent activations feed */}
        <div className="lg:col-span-7">
          <BentoStatisticsCard
            title="Subscriber Fleet Statistics"
            tab1Label="By Status"
            tab2Label="By Plan"
            headlineValue={`${totalSubs} Subscribers`}
            headlineSubtitle={`${activePct}% active · ${suspendedPct}% suspended · ${churnedPct}% churned across the subscriber fleet`}
            tab1Bars={ispTab1Bars}
            tab2Bars={ispTab2Bars}
            className="h-full"
          />
        </div>
        <div className="lg:col-span-5">
          <BentoActivityFeed
            title="Recent Activations & Alerts"
            orders={[
              {
                id: 'isp-act-1',
                name: data.subscribers.active > 0 ? `${data.subscribers.active} active subscribers` : 'No active subscribers yet',
                avatarText: 'A',
                avatarColor: 'bg-emerald-500',
                description: `Fleet health: ${activePct}% online`,
                time: 'Now',
                value: `${activePct}%`,
                badgeText: activePct >= 70 ? 'Healthy' : 'Watch',
                badgeTone: (activePct >= 70 ? 'emerald' : 'teal') as 'emerald' | 'teal',
              },
              {
                id: 'isp-act-2',
                name: data.subscribers.suspended > 0 ? `${data.subscribers.suspended} suspended` : 'No suspensions',
                avatarText: 'S',
                avatarColor: data.subscribers.suspended > 0 ? 'bg-amber-500' : 'bg-slate-400',
                description: 'Payment overdue · follow up needed',
                time: '',
                value: `${suspendedPct}%`,
                badgeText: data.subscribers.suspended > 0 ? 'Overdue' : 'Clear',
                badgeTone: (data.subscribers.suspended > 0 ? 'sky' : 'emerald') as 'sky' | 'emerald',
              },
              {
                id: 'isp-act-3',
                name: data.scheduledWorkOrders > 0 ? `${data.scheduledWorkOrders} field jobs pending` : 'No pending work orders',
                avatarText: 'W',
                avatarColor: data.scheduledWorkOrders > 0 ? 'bg-blue-500' : 'bg-slate-400',
                description: 'Technician dispatches & installations',
                time: '',
                value: `${data.scheduledWorkOrders}`,
                badgeText: data.scheduledWorkOrders > 0 ? 'Pending' : 'Clear',
                badgeTone: (data.scheduledWorkOrders > 0 ? 'indigo' : 'emerald') as 'indigo' | 'emerald',
              },
              {
                id: 'isp-act-4',
                name: data.openTickets > 0 ? `${data.openTickets} support ticket${data.openTickets > 1 ? 's' : ''} open` : 'No open tickets',
                avatarText: 'T',
                avatarColor: data.openTickets > 0 ? 'bg-rose-500' : 'bg-emerald-500',
                description: 'Subscriber complaints & SLA tracking',
                time: '',
                value: `${data.openTickets}`,
                badgeText: data.openTickets > 0 ? 'Open' : 'Resolved',
                badgeTone: (data.openTickets > 0 ? 'sky' : 'emerald') as 'sky' | 'emerald',
              },
            ]}
            className="h-full"
          />
        </div>
      </div>

      {/* ── Mobile KPI cards ─────────────────────────────────────────────────── */}
      <div className="lg:hidden">
        <DashboardKpiRows rows={ISP_KPI_ROWS} data={data} />
      </div>

      {/* ── Operational Bento Grid (12 cols on desktop) ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Network Health / Subscriber Fleet Status */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-[var(--color-accent)]" />
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Subscriber Fleet Status
                </h2>
              </div>
              <Link
                href="/subscribers"
                className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center gap-1"
              >
                Manage subscribers <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Multi-segmented health bar */}
            <div className="h-3.5 w-full rounded-full bg-[var(--color-bg-elevated)] overflow-hidden flex gap-0.5 mb-4 p-0.5 border border-[var(--color-border)]/60">
              {activePct > 0 && (
                <div
                  style={{ width: `${activePct}%` }}
                  className="bg-emerald-500 h-full rounded-l-full transition-all duration-500"
                  title={`Active: ${data.subscribers.active}`}
                />
              )}
              {suspendedPct > 0 && (
                <div
                  style={{ width: `${suspendedPct}%` }}
                  className="bg-amber-500 h-full transition-all duration-500"
                  title={`Suspended: ${data.subscribers.suspended}`}
                />
              )}
              {churnedPct > 0 && (
                <div
                  style={{ width: `${churnedPct}%` }}
                  className="bg-rose-500 h-full rounded-r-full transition-all duration-500"
                  title={`Churned: ${data.subscribers.churned}`}
                />
              )}
            </div>

            {/* 3 Status Tiers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center sm:text-left">
              <Link
                href="/subscribers?filter=ACTIVE"
                className="rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
              >
                <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Active</span>
                </div>
                <span className="text-xl font-black text-emerald-900 dark:text-emerald-200 block mt-1">
                  {data.subscribers.active}
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                  {activePct}% of fleet
                </span>
              </Link>

              <Link
                href="/subscribers?filter=SUSPENDED"
                className="rounded-xl border border-amber-100 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
              >
                <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                  <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Suspended</span>
                </div>
                <span className="text-xl font-black text-amber-900 dark:text-amber-200 block mt-1">
                  {data.subscribers.suspended}
                </span>
                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                  Payment overdue
                </span>
              </Link>

              <Link
                href="/subscribers?filter=CHURNED"
                className="rounded-xl border border-rose-100 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 p-3 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                  <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">Churned</span>
                </div>
                <span className="text-xl font-black text-rose-900 dark:text-rose-200 block mt-1">
                  {data.subscribers.churned}
                </span>
                <span className="text-[10px] text-rose-700 dark:text-rose-400 font-medium">
                  Decommissioned
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): AI Operational Recommendations */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-white shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <h2 className="font-bold text-sm text-[var(--color-text-primary)]">
                  AI Smart Recommendations
                </h2>
              </div>
              <span className="text-[10px] font-bold text-[var(--color-accent)] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                Autonomous Insights
              </span>
            </div>

            <div className="flex flex-col rounded-2xl border border-green-200 dark:border-green-900/50 bg-[#F4FCF7] dark:bg-emerald-950/10 p-4 sm:p-5 shadow-sm">
              {/* Featured / Top Priority Recommendation */}
              {topRec && (
                <div className="flex items-start gap-3 sm:gap-4 pb-4 border-b border-green-200/70 dark:border-green-800/50">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent)] shadow-sm text-white">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wide ${
                          topRec.priority === 'HIGH'
                            ? 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                            : topRec.priority === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        }`}
                      >
                        {topRec.priority} PRIORITY
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)] leading-tight">
                      {topRec.action}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 leading-relaxed">
                      {topRec.reason}
                    </p>
                    {topRec.href && (
                      <div className="mt-3">
                        <Link
                          href={topRec.href}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] bg-white dark:bg-emerald-950/20 px-3.5 py-1.5 rounded-xl border border-[var(--color-accent)]/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors shadow-sm"
                        >
                          Take action <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Secondary Recommendations */}
              {otherRecs.length > 0 && (
                <div className="pt-3.5 space-y-2.5">
                  {otherRecs.map((rec, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/80 dark:bg-emerald-950/10 border border-green-100/80 dark:border-green-900/50 shadow-sm hover:bg-white dark:hover:bg-emerald-950/20 transition-colors"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                            rec.priority === 'HIGH'
                              ? 'bg-red-500'
                              : rec.priority === 'MEDIUM'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                            {rec.action}
                          </p>
                          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 line-clamp-1 leading-normal">
                            {rec.reason}
                          </p>
                        </div>
                      </div>
                      {rec.href && (
                        <Link
                          href={rec.href}
                          className="text-xs font-bold text-[var(--color-accent)] hover:underline shrink-0 flex items-center gap-0.5 pt-0.5"
                        >
                          Resolve →
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default IspDashboard;
