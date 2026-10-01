'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { format } from 'date-fns';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import {
  getTaxReconciliation,
  type TaxAnomaly,
} from '@/services/tax.service';
import { formatCurrency } from '@/lib/utils';
import { taxPeriod } from '@/lib/tax-report';
import {
  deadlineLabel,
  isDeadlineUrgent,
  summarizeAnomalies,
  taxAnomalyMeta,
} from '@/lib/tax-reconciliation';

/**
 * Phase E — reconciliation dashboard. Team-tier depth (paywall Section 1A), so
 * the backend route is `@RequiresFeatures(TaxReconciliation)` and `api-client`
 * routes a Solo org to the paywall on the resulting 403. Strictly read-only:
 * there is no form, input or mutation here, and the guard test fails if one is
 * ever added.
 */
export default function TaxReconciliationPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const organizationId = membership?.organization?.id ?? null;

  const [monthOffset, setMonthOffset] = useState(0);
  const period = useMemo(() => taxPeriod(monthOffset), [monthOffset]);

  const { data: report, isLoading, error } = useSWR(
    organizationId
      ? ['tax-reconciliation', organizationId, period.from, period.to]
      : null,
    async () => {
      const token = await getToken();
      if (!token) return null;
      return getTaxReconciliation(token, organizationId as string, {
        from: period.from,
        to: period.to,
      });
    },
  );

  const summary = summarizeAnomalies(report?.anomalies ?? []);
  const locked = error instanceof Error && error.name === 'FeatureLockedError';

  return (
    <div className="space-y-6 pb-24">
      <div>
        <Link
          href="/tax"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Tax
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reconciliation</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Filed tax vs expected sales, checked ahead of the filing
              deadline.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
            <Lock className="h-3.5 w-3.5" />
            Team
          </span>
        </div>
      </div>

      {/* ── Period navigator (read-only) ───────────────────────────────── */}
      <div className="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonthOffset((value) => value - 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">{period.label}</span>
        <button
          type="button"
          aria-label="Next month"
          disabled={monthOffset >= 0}
          onClick={() => setMonthOffset((value) => Math.min(0, value + 1))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {locked ? (
        <section className="rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-bg-surface)] p-5">
          <p className="text-sm font-semibold">Reconciliation is a Team feature</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Upgrade to Team to compare filed tax with expected sales and catch
            mismatches before the deadline.
          </p>
          <Link
            href="/paywall?feature=reconciliation"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 text-sm font-semibold text-white"
          >
            See Team
          </Link>
        </section>
      ) : error ? (
        <div className="rounded-2xl border border-[var(--color-status-critical)]/30 bg-[var(--color-status-critical)]/10 p-4 text-sm text-[var(--color-status-critical)]">
          Couldn&apos;t load reconciliation. Nothing here is up to date until it
          loads.
        </div>
      ) : isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]" />
      ) : (
        <>
          {/* ── Deadline + summary ─────────────────────────────────────── */}
          <section
            className="rounded-2xl border p-4"
            style={{
              borderColor: `color-mix(in srgb, ${
                isDeadlineUrgent(report?.daysUntilDeadline ?? 99)
                  ? 'var(--color-status-warning)'
                  : 'var(--color-text-secondary)'
              } 30%, transparent)`,
            }}
          >
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4" />
              {report?.period.label} VAT filing deadline:{' '}
              {report
                ? format(new Date(report.filingDeadline), 'd MMM yyyy')
                : '—'}
            </p>
            <p
              className="mt-1 text-sm"
              style={{
                color: isDeadlineUrgent(report?.daysUntilDeadline ?? 99)
                  ? 'var(--color-status-warning)'
                  : 'var(--color-text-secondary)',
              }}
            >
              {report ? deadlineLabel(report.daysUntilDeadline) : ''}
            </p>
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile
              icon={<BadgeCheck className="h-4 w-4" />}
              label="Sales checked"
              value={String(report?.checkedInvoices ?? 0)}
              accent="var(--color-text-secondary)"
            />
            <Tile
              icon={<ShieldAlert className="h-4 w-4" />}
              label="Critical mismatches"
              value={String(summary.critical)}
              accent={
                summary.critical > 0
                  ? 'var(--color-status-critical)'
                  : 'var(--color-text-muted)'
              }
            />
            <Tile
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Warnings"
              value={String(summary.warning)}
              accent={
                summary.warning > 0
                  ? 'var(--color-status-warning)'
                  : 'var(--color-text-muted)'
              }
            />
          </section>

          {/* ── Anomalies ─────────────────────────────────────────────── */}
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
            <h2 className="text-base font-semibold">Anomalies</h2>
            {(report?.anomalies ?? []).length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-[var(--color-status-success)]">
                <BadgeCheck className="h-4 w-4" />
                No mismatches — filed sales match expected activity for this
                period.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--color-border)]">
                {(report?.anomalies ?? []).map((anomaly) => (
                  <AnomalyRow key={anomaly.key} anomaly={anomaly} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <p className="text-center text-xs text-[var(--color-text-muted)]">
        Read-only. Figures come from invoices and KRA-confirmed filings — nothing
        here is entered by hand.
      </p>
    </div>
  );
}

function AnomalyRow({ anomaly }: { anomaly: TaxAnomaly }) {
  const meta = taxAnomalyMeta(anomaly.type);
  const color =
    anomaly.severity === 'critical'
      ? 'var(--color-status-critical)'
      : 'var(--color-status-warning)';
  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{meta.label}</p>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
          style={{
            color,
            backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
          }}
        >
          {anomaly.severity}
        </span>
      </div>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        {anomaly.message}
      </p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
        {meta.description}
        {anomaly.expectedTaxAmount !== null
          ? ` Expected VAT ${formatCurrency(anomaly.expectedTaxAmount, 'KES')}`
          : ''}
        {anomaly.filedTaxAmount !== null
          ? ` · Filed ${formatCurrency(anomaly.filedTaxAmount, 'KES')}`
          : ''}
      </p>
    </li>
  );
}

function Tile({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
      <div className="flex items-center gap-2" style={{ color: accent }}>
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-2 text-xl font-bold text-[var(--color-text-primary)]">
        {value}
      </p>
    </div>
  );
}
