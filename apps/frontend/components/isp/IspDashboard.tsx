'use client';

import React from 'react';
import useSWR from 'swr';
import { useAuth, useUser } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import Link from 'next/link';
import {
  Wifi,
  Users,
  Wrench,
  Headphones,
  CircleDollarSign,
  TrendingUp,
  AlertTriangle,
  Radio,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Package,
  Sparkles,
} from 'lucide-react';
import { getIspDashboard, type IspDashboardData } from '@/services/isp.service';
import DashboardLoading from '@/app/(dashboard)/loading';

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

  return (
    <div className="flex flex-col gap-6 pb-24 max-w-4xl mx-auto">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold flex items-center gap-2 text-[var(--color-text-primary)]">
            Good {timeOfDay}, {firstName} {greetingEmoji}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              ISP Operations Center
            </span>
            <span className="text-xs text-[var(--color-text-secondary)]">
              {membership?.organization?.name}
            </span>
          </div>
        </div>

        {/* Top Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/subscribers?action=add"
            className="flex items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            New Subscriber
          </Link>
          <Link
            href="/work-orders"
            className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
          >
            <Wrench className="h-3.5 w-3.5" />
            Field Work & Dispatch
          </Link>
        </div>
      </div>

      {/* ── Primary KPI Section — Clean Executive Layout ────────────── */}
      <div className="flex flex-col gap-4">
        {/* Tier 1: Featured Hero Cards (Revenue + Active Subscribers) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Monthly Recurring Revenue */}
          <Link
            href="/finance"
            className="group flex flex-col justify-between rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/40 via-[var(--color-bg-surface)] to-[var(--color-bg-surface)] p-4 sm:p-5 shadow-xs hover:border-blue-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 shrink-0">
                  <CircleDollarSign className="h-4.5 w-4.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                    Monthly Revenue
                  </span>
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    Recurring Invoicing
                  </span>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-[var(--color-text-muted)] group-hover:text-blue-600 transition-colors shrink-0" />
            </div>

            <div className="my-1">
              <p className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)] tracking-tight">
                KES {data.monthlyRevenue.toLocaleString()}
              </p>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)]">
              {data.subscribers.active > 0
                ? `KES ${Math.round(data.monthlyRevenue / data.subscribers.active).toLocaleString()} ARPU / active sub`
                : 'No billing activity yet'}
            </p>
          </Link>

          {/* Card 2: Subscriber Network Fleet */}
          <Link
            href="/subscribers"
            className="group flex flex-col justify-between rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-[var(--color-bg-surface)] to-[var(--color-bg-surface)] p-4 sm:p-5 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                  <Radio className="h-4.5 w-4.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider block">
                    Active Subscribers
                  </span>
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    Total Fleet: {data.subscribers.total}
                  </span>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-[var(--color-text-muted)] group-hover:text-emerald-600 transition-colors shrink-0" />
            </div>

            <div className="my-1">
              <p className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)] tracking-tight">
                {data.subscribers.active}{' '}
                <span className="text-base sm:text-lg font-medium text-[var(--color-text-secondary)]">
                  / {data.subscribers.total}
                </span>
              </p>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)]">
              {data.subscribers.suspended > 0
                ? `${data.subscribers.suspended} suspended • ${activePct}% online`
                : `${activePct}% fleet online`}
            </p>
          </Link>
        </div>

        {/* Tier 2: Operational Action Cards (Field Deployment + Support Queue) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 3: Field Work Orders */}
          <Link
            href="/work-orders"
            className="group flex flex-col justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 sm:p-5 shadow-xs hover:border-amber-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shrink-0">
                  <Wrench className="h-4.5 w-4.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[var(--color-text-primary)] block">
                    Field Work & Dispatch
                  </span>
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    Technician Deployments
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  data.scheduledWorkOrders > 0
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {data.scheduledWorkOrders > 0 ? `${data.scheduledWorkOrders} Pending` : 'All Clear'}
              </span>
            </div>

            <div className="my-1">
              <p className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)]">
                {data.scheduledWorkOrders}
              </p>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)]">
              {data.scheduledWorkOrders > 0
                ? `${data.scheduledWorkOrders} job${data.scheduledWorkOrders > 1 ? 's' : ''} scheduled`
                : 'No pending field dispatches'}
            </p>
          </Link>

          {/* Card 4: Support Tickets Queue */}
          <Link
            href="/tickets"
            className="group flex flex-col justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 sm:p-5 shadow-xs hover:border-rose-400 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700 shrink-0">
                  <Headphones className="h-4.5 w-4.5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[var(--color-text-primary)] block">
                    Support Queue
                  </span>
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    Subscriber Complaints
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  data.openTickets > 0
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {data.openTickets > 0 ? `${data.openTickets} Open` : 'Resolved'}
              </span>
            </div>

            <div className="my-1">
              <p className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)]">
                {data.openTickets}
              </p>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)]">
              {data.openTickets > 0
                ? `${data.openTickets} ticket${data.openTickets > 1 ? 's' : ''} awaiting review`
                : 'All subscriber tickets resolved'}
            </p>
          </Link>
        </div>
      </div>

      {/* ── AI Operational Recommendations (Smart Recommendations) ──────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-[var(--color-accent)] flex items-center justify-center text-white shadow-xs">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">
              AI Smart Recommendations
            </h2>
          </div>
          <span className="text-[10px] font-bold text-[var(--color-accent)] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            Autonomous Insights
          </span>
        </div>

        <div className="flex flex-col rounded-2xl border border-green-200 bg-[#F4FCF7] p-4 sm:p-5 shadow-sm">
          {/* Featured / Top Priority Recommendation */}
          {topRec && (
            <div className="flex items-start gap-3 sm:gap-4 pb-4 border-b border-green-200/70">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-accent)] shadow-sm text-white">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wide ${
                      topRec.priority === 'HIGH'
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : topRec.priority === 'MEDIUM'
                        ? 'bg-amber-100 text-amber-700 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {topRec.priority} PRIORITY
                  </span>
                </div>
                <p className="text-sm sm:text-base font-bold text-[var(--color-text-primary)] leading-tight">
                  {topRec.action}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1.5 leading-relaxed">
                  {topRec.reason}
                </p>
                {topRec.href && (
                  <div className="mt-3">
                    <Link
                      href={topRec.href}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-accent)] bg-white px-3.5 py-1.5 rounded-xl border border-[var(--color-accent)]/30 hover:bg-emerald-50 transition-colors shadow-2xs"
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
                  className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white/80 border border-green-100/80 shadow-2xs hover:bg-white transition-colors"
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

      {/* ── Network Health / Subscriber Fleet Status ────────────────────── */}
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
        <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden flex gap-0.5 mb-4">
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
        <div className="grid grid-cols-3 gap-3 text-center sm:text-left">
          <Link
            href="/subscribers?filter=ACTIVE"
            className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 hover:bg-emerald-50 transition-colors"
          >
            <div className="flex items-center gap-1.5 justify-center sm:justify-start">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-xs font-semibold text-emerald-800">Active</span>
            </div>
            <span className="text-lg font-black text-emerald-900 block mt-1">
              {data.subscribers.active}
            </span>
            <span className="text-[10px] text-emerald-700 font-medium">
              {activePct}% of fleet
            </span>
          </Link>

          <Link
            href="/subscribers?filter=SUSPENDED"
            className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 hover:bg-amber-50 transition-colors"
          >
            <div className="flex items-center gap-1.5 justify-center sm:justify-start">
              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
              <span className="text-xs font-semibold text-amber-800">Suspended</span>
            </div>
            <span className="text-lg font-black text-amber-900 block mt-1">
              {data.subscribers.suspended}
            </span>
            <span className="text-[10px] text-amber-700 font-medium">
              Payment overdue
            </span>
          </Link>

          <Link
            href="/subscribers?filter=CHURNED"
            className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 hover:bg-rose-50 transition-colors"
          >
            <div className="flex items-center gap-1.5 justify-center sm:justify-start">
              <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
              <span className="text-xs font-semibold text-rose-800">Churned</span>
            </div>
            <span className="text-lg font-black text-rose-900 block mt-1">
              {data.subscribers.churned}
            </span>
            <span className="text-[10px] text-rose-700 font-medium">
              Decommissioned
            </span>
          </Link>
        </div>
      </div>

      {/* ── Quick Navigation Hub ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/service-plans"
          className="flex flex-col p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-accent)] transition-all group"
        >
          <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Wifi className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-[var(--color-text-primary)]">Service Plans</span>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Speed tiers & pricing</span>
        </Link>

        <Link
          href="/work-orders"
          className="flex flex-col p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-accent)] transition-all group"
        >
          <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Wrench className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-[var(--color-text-primary)]">Field Work & Dispatch</span>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Deployments & repairs</span>
        </Link>

        <Link
          href="/tickets"
          className="flex flex-col p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-accent)] transition-all group"
        >
          <div className="h-8 w-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Headphones className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-[var(--color-text-primary)]">Support Queue</span>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Troubleshoot issues</span>
        </Link>

        <Link
          href="/inventory"
          className="flex flex-col p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:border-[var(--color-accent)] transition-all group"
        >
          <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Package className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-[var(--color-text-primary)]">Hardware Stock</span>
          <span className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Routers, ONUs, Fiber</span>
        </Link>
      </div>
    </div>
  );
}

export default IspDashboard;
