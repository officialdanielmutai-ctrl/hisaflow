'use client';

import useSWR from 'swr';
import { useAuth, useUser } from '@clerk/nextjs';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import Link from 'next/link';
import {
  Users, GraduationCap, BookOpen, TrendingUp, AlertTriangle,
  Banknote, CheckCircle2, CircleDollarSign, Clock, Plus, ReceiptText,
} from 'lucide-react';
import { getSchoolDashboardData, type SchoolDashboardData } from '@/services/analytics.service';
import DashboardLoading from '@/app/(dashboard)/loading';
import { format } from 'date-fns';

function KpiCard({
  href, icon: Icon, iconBg, iconColor, label, value, sub, subColor,
}: {
  href?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: React.ReactNode;
  sub?: string;
  subColor?: string;
}) {
  const inner = (
    <div className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm h-full">
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${iconBg} shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-[var(--color-text-secondary)] truncate">{label}</span>
          <span className="text-2xl font-bold text-[var(--color-text-primary)] leading-tight">{value}</span>
        </div>
      </div>
      {sub && <span className={`text-[10px] font-semibold ${subColor ?? 'text-[var(--color-text-muted)]'}`}>{sub}</span>}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-90 transition-opacity">{inner}</Link>
    );
  }
  return inner;
}

export function SchoolDashboard() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { membership } = useMyOrganization();
  const orgId = membership?.organization.id;

  const { data, error, isLoading } = useSWR<SchoolDashboardData>(
    orgId ? ['school-dashboard', orgId] : null,
    async () => {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      return getSchoolDashboardData(token, orgId!);
    },
  );

  if (isLoading) return <DashboardLoading />;
  if (error || !data) {
    return <div className="py-12 text-center text-[var(--color-text-secondary)]">{error?.message ?? 'No data available'}</div>;
  }

  const firstName = user?.firstName ?? 'there';
  const greetingEmoji = data.timeOfDay === 'morning' ? '👋' : data.timeOfDay === 'afternoon' ? '☀️' : '🌙';

  const collectionBarWidth = Math.min(data.fees.collectionRate, 100);

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            Good {data.timeOfDay}, {firstName} {greetingEmoji}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{membership?.organization.name}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/students"
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-[var(--color-primary)] text-white shadow-sm hover:opacity-90 transition-opacity"
        >
          <Users className="h-6 w-6 mb-2" />
          <span className="text-xs font-bold text-center leading-tight">Students</span>
        </Link>
        <Link
          href="/school-classes"
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <BookOpen className="h-6 w-6 mb-2 text-[var(--color-primary)]" />
          <span className="text-xs font-bold text-center leading-tight">Classes</span>
        </Link>
        <Link
          href="/school-fees"
          className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <ReceiptText className="h-6 w-6 mb-2 text-[var(--color-primary)]" />
          <span className="text-xs font-bold text-center leading-tight">Fees</span>
        </Link>
      </div>

      {/* Active Term Banner */}
      {data.activeTerm ? (
        <div className="flex items-center justify-between rounded-2xl bg-blue-50 border border-blue-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-500">Active Term</p>
              <p className="text-sm font-bold text-gray-900">{data.activeTerm.name}</p>
            </div>
          </div>
          {data.activeTerm.dueDate && (
            <div className="text-right">
              <p className="text-[10px] text-blue-400 font-semibold">Fee Due Date</p>
              <p className="text-xs font-bold text-blue-700">
                {format(new Date(data.activeTerm.dueDate), 'MMM d, yyyy')}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl bg-yellow-50 border border-yellow-200 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
          <p className="text-sm font-semibold text-yellow-800">No active term set.</p>
          <Link href="/school-fees" className="ml-auto text-xs font-bold text-yellow-700 hover:underline">
            Set Term →
          </Link>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          href="/students"
          icon={Users}
          iconBg="bg-indigo-100"
          iconColor="text-indigo-600"
          label="Total Students"
          value={data.totalStudents}
          sub="Active enrollment"
        />
        <KpiCard
          href="/school-classes"
          icon={BookOpen}
          iconBg="bg-teal-100"
          iconColor="text-teal-600"
          label="Active Classes"
          value={data.totalClasses}
          sub="Streams included"
        />
        <KpiCard
          href="/school-fees"
          icon={CheckCircle2}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          label="Fees Collected"
          value={`KES ${data.fees.totalCollected.toLocaleString()}`}
          sub={`${data.fees.paidCount} of ${data.fees.totalInvoices} invoices paid`}
          subColor="text-green-600"
        />
        <KpiCard
          href="/school-fees"
          icon={Banknote}
          iconBg="bg-red-100"
          iconColor="text-red-500"
          label="Outstanding"
          value={`KES ${data.fees.outstanding.toLocaleString()}`}
          sub={`${100 - data.fees.collectionRate}% unpaid`}
          subColor={data.fees.outstanding > 0 ? 'text-red-500' : 'text-green-600'}
        />
      </div>

      {/* Fee Collection Progress */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Fee Collection Rate</h2>
          <span className="text-xs font-bold text-[var(--color-accent)]">{data.fees.collectionRate}%</span>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] mb-2">
            <span>KES {data.fees.totalCollected.toLocaleString()} collected</span>
            <span>Target: KES {data.fees.totalExpected.toLocaleString()}</span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
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
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Pending Invoices</h2>
            <Link href="/school-fees" className="text-xs font-semibold text-[var(--color-accent)] hover:underline flex items-center">
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
                  <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{inv.studentName}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{inv.termName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-orange-600">KES {inv.amountDue.toLocaleString()}</p>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${inv.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
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
            <h2 className="font-bold text-sm text-[var(--color-text-primary)]">Recent Payments</h2>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
            {data.recentPayments.map((p, idx) => (
              <div
                key={p.id}
                className={`flex items-center justify-between px-4 py-3 ${idx !== data.recentPayments.length - 1 ? 'border-b border-[var(--color-border)]' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <CircleDollarSign className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{p.studentName}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{p.method}</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-green-600">+KES {p.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
