'use client';

import React from 'react';
import useSWR from 'swr';
import {
  Building2,
  Users,
  Wifi,
  Radio,
  Cpu,
  ShieldCheck,
  TrendingUp,
  Clock,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { adminFetch } from '@/lib/api-client';
import { DashboardResponse } from '@/lib/types';

export default function AdminDashboardPage() {
  const { data, error, isLoading } = useSWR<DashboardResponse>('/admin/dashboard/kpis', (url: string) =>
    adminFetch(url),
  );

  const kpis = data?.kpis;
  const recentLogs = data?.recentActivity || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-admin-800/80">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Platform Overview</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-tenant telemetry and administrative activity across HisaFlow services.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Sync
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Active Orgs */}
        <div className="bg-admin-900/80 border border-admin-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-admin-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Orgs</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {isLoading ? '...' : kpis?.activeOrganizations ?? 0}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 mt-1">
              <TrendingUp className="w-3 h-3" />
              <span>+{kpis?.newSignupsThisWeek ?? 0} this week</span>
            </div>
          </div>
        </div>

        {/* Total Users */}
        <div className="bg-admin-900/80 border border-admin-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-admin-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Users</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {isLoading ? '...' : kpis?.totalUsers ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">Clerk Verified</div>
          </div>
        </div>

        {/* ISP Subscribers */}
        <div className="bg-admin-900/80 border border-admin-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-admin-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Subscribers</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Wifi className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {isLoading ? '...' : kpis?.totalSubscribers ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">ISP Customer Base</div>
          </div>
        </div>

        {/* Connected Routers */}
        <div className="bg-admin-900/80 border border-admin-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-admin-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">MikroTik Routers</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {isLoading ? '...' : kpis?.activeRouters ?? 0}
            </div>
            <div className="text-[11px] text-emerald-400 mt-1 font-mono">Online & Managed</div>
          </div>
        </div>

        {/* AI Health */}
        <div className="bg-admin-900/80 border border-admin-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-admin-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">LiteLLM Proxy</span>
            <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold text-emerald-400 tracking-tight">
              {isLoading ? '...' : kpis?.aiProviderHealth ?? 'CONNECTED'}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">Failover Active</div>
          </div>
        </div>

        {/* Open Alerts */}
        <div className="bg-admin-900/80 border border-admin-800 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-admin-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Unresolved Alerts</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              {isLoading ? '...' : kpis?.openAlerts ?? 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono">Platform Anomaly Flags</div>
          </div>
        </div>
      </div>

      {/* Quick Launch & Activity Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Audit Trail */}
        <div className="lg:col-span-2 bg-admin-900/60 border border-admin-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-admin-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-white">Recent Administrative Actions</h2>
            </div>
            <Link
              href="/audit"
              className="text-xs text-brand-400 hover:text-brand-300 font-medium inline-flex items-center gap-1 transition-colors"
            >
              View Full Audit Log <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="mt-4">
            {recentLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                {isLoading ? 'Loading activity...' : 'No administrative actions recorded yet.'}
              </div>
            ) : (
              <div className="divide-y divide-admin-800/60">
                {recentLogs.map((log) => (
                  <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-200">{log.actionType}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-admin-800 text-slate-400">
                            {log.targetType}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          by <span className="text-slate-300 font-medium">{log.admin?.name || log.adminId}</span>
                          {log.targetLabel && (
                            <>
                              {' '}
                              on <span className="text-slate-200 font-medium">"{log.targetLabel}"</span>
                            </>
                          )}
                          {log.reason && <span className="text-amber-300/80 ml-1 italic">("{log.reason}")</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 whitespace-nowrap shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Quick Control Shortcuts */}
        <div className="space-y-4">
          <div className="bg-admin-900/60 border border-admin-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-400">
              Operations Hub
            </h3>

            <Link
              href="/accounts"
              className="flex items-center justify-between p-3 rounded-lg bg-admin-850/60 border border-admin-800 hover:border-brand-500/50 hover:bg-admin-800 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Accounts & Orgs</div>
                  <div className="text-[11px] text-slate-400">Lookup, inspect & freeze</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </Link>

            <Link
              href="/providers"
              className="flex items-center justify-between p-3 rounded-lg bg-admin-850/60 border border-admin-800 hover:border-brand-500/50 hover:bg-admin-800 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">AI Provider Routing</div>
                  <div className="text-[11px] text-slate-400">LiteLLM model priority</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </Link>

            <Link
              href="/comms"
              className="flex items-center justify-between p-3 rounded-lg bg-admin-850/60 border border-admin-800 hover:border-brand-500/50 hover:bg-admin-800 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Bulk Communications</div>
                  <div className="text-[11px] text-slate-400">Email & SMS broadcast</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
