'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { format } from 'date-fns';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  Loader2,
  Lock,
  Receipt,
} from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import { getTaxReport, type TaxReportInvoice } from '@/services/tax.service';
import { formatCurrency } from '@/lib/utils';
import {
  summarizeTaxReport,
  taxFilingStatusMeta,
  taxPeriod,
  TAX_TAB_READ_ONLY_NOTE,
  type TaxFilingTone,
} from '@/lib/tax-report';

const TONE_COLORS: Record<TaxFilingTone, string> = {
  active: 'var(--color-status-success)',
  pending: 'var(--color-status-warning)',
  danger: 'var(--color-status-critical)',
};

const EMPTY_SUMMARY = summarizeTaxReport([]);

/**
 * Phase D — the Tax tab. Strictly read-only: it only renders what the backend
 * calculated and filed automatically. There is no form, input, or mutation
 * here, and `lib/tax-report.test.ts` fails if one is ever added (tax-system doc
 * Section 1 — the core design principle).
 */
export default function TaxTabPage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const organizationId = membership?.organization?.id ?? null;

  const [monthOffset, setMonthOffset] = useState(0);
  const period = useMemo(() => taxPeriod(monthOffset), [monthOffset]);

  const { data: report, isLoading, error } = useSWR(
    organizationId
      ? ['tax-report', organizationId, period.from, period.to]
      : null,
    async () => {
      const token = await getToken();
      if (!token) return null;
      return getTaxReport(token, organizationId as string, {
        from: period.from,
        to: period.to,
      });
    },
  );

  const summary = report?.summary ?? EMPTY_SUMMARY;

  return (
    <div className="space-y-6 pb-24">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tax</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            What has been calculated and filed automatically.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
          <Lock className="h-3.5 w-3.5" />
          Read-only
        </span>
      </header>

      {/* ── Period navigator ───────────────────────────────────────────── */}
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

      {error && (
        <div className="rounded-2xl border border-[var(--color-status-critical)]/30 bg-[var(--color-status-critical)]/10 p-4 text-sm text-[var(--color-status-critical)]">
          Couldn&apos;t load tax status. Nothing here is up to date until it
          loads.
        </div>
      )}

      {/* ── Registration state (informational only) ────────────────────── */}
      {!isLoading && report?.registration == null && (
        <Banner tone="neutral" title="eTIMS is not set up for this business">
          Add your KRA PIN in Settings to start filing. Until then there is
          nothing to report here.{' '}
          <Link href="/settings/tax" className="font-semibold underline">
            Set up in Settings
          </Link>
        </Banner>
      )}
      {!isLoading && report?.registration && !report.registration.canFileLive && (
        <Banner tone="warning" title="Filing is on hold">
          eTIMS registration is not production-active yet (
          {report.registration.status.replace(/_/g, ' ').toLowerCase()}). Signed
          invoices queue until KRA approves.{' '}
          <Link href="/settings/tax" className="font-semibold underline">
            View registration
          </Link>
        </Banner>
      )}
      {!isLoading && report?.registration?.canFileLive && (
        <Banner tone="success" title="Live filing on">
          Sales are signed and filed with KRA automatically.
        </Banner>
      )}

      {/* ── Period summary ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]" />
      ) : (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryTile
              icon={<FileCheck2 className="h-4 w-4" />}
              label="VAT filed"
              value={formatCurrency(summary.taxAmount, 'KES')}
              hint={`${summary.filed} invoice${summary.filed === 1 ? '' : 's'} confirmed`}
              accent="var(--color-status-success)"
            />
            <SummaryTile
              icon={<Loader2 className="h-4 w-4" />}
              label="Awaiting filing"
              value={formatCurrency(summary.pendingTaxAmount, 'KES')}
              hint={`${summary.pending} pending`}
              accent="var(--color-status-warning)"
            />
            <SummaryTile
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Needs attention"
              value={String(summary.failed)}
              hint="KRA errors"
              accent={
                summary.failed > 0
                  ? 'var(--color-status-critical)'
                  : 'var(--color-text-muted)'
              }
            />
          </section>

          <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-4 py-3 text-xs text-[var(--color-text-secondary)]">
            Filed taxable value {formatCurrency(summary.taxableAmount, 'KES')} ·
            gross {formatCurrency(summary.grossAmount, 'KES')}. Figures are
            computed from invoices KRA has already accepted.
          </p>

          <Link
            href="/tax/reconciliation"
            className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4"
          >
            <div>
              <p className="text-sm font-semibold">Reconciliation</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Team: compare filed tax with expected sales and catch mismatches
                before the deadline.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          </Link>

          <Link
            href="/tax/aggregate"
            className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4"
          >
            <div>
              <p className="text-sm font-semibold">Locations</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Growth: tax aggregated across every location in one summary.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
          </Link>

          {/* ── Invoices ───────────────────────────────────────────────── */}
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Receipt className="h-4 w-4" />
              Invoices this period
            </h2>

            {(report?.invoices ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                No tax invoices for {period.label}. Sales appear here
                automatically.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--color-border)]">
                {(report?.invoices ?? []).map((invoice) => (
                  <InvoiceRow key={invoice.invoiceId} invoice={invoice} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <p className="text-center text-xs text-[var(--color-text-muted)]">
        {TAX_TAB_READ_ONLY_NOTE}
      </p>
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: TaxReportInvoice }) {
  const meta = taxFilingStatusMeta(invoice.status);
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold">
          {formatCurrency(invoice.grossAmount, invoice.currency === 'KES' ? 'KES' : invoice.currency)}
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              color: TONE_COLORS[meta.tone],
              backgroundColor: `color-mix(in srgb, ${TONE_COLORS[meta.tone]} 12%, transparent)`,
            }}
          >
            {meta.label}
          </span>
        </p>
        <p className="truncate text-xs text-[var(--color-text-muted)]">
          {format(new Date(invoice.createdAt), 'd MMM yyyy')} · #
          {invoice.invoiceId.slice(-6)} · VAT{' '}
          {formatCurrency(invoice.taxAmount, 'KES')}
        </p>
        {(invoice.kraInvoiceNumber || invoice.vscuReceiptNumber) && (
          <p className="truncate text-xs text-[var(--color-text-muted)]">
            KRA ref {invoice.kraInvoiceNumber ?? invoice.vscuReceiptNumber}
          </p>
        )}
        {invoice.status === 'PENDING' && invoice.nextAttemptAt && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Retrying {format(new Date(invoice.nextAttemptAt), 'd MMM, HH:mm')}
          </p>
        )}
        {invoice.status === 'FAILED' && invoice.lastError && (
          <p className="truncate text-xs text-[var(--color-status-critical)]">
            {invoice.lastError}
          </p>
        )}
      </div>
      <span className="shrink-0 text-right text-xs text-[var(--color-text-secondary)]">
        {invoice.signed ? 'Signed' : 'Awaiting signature'}
      </span>
    </li>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
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
      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{hint}</p>
    </div>
  );
}

function Banner({
  tone,
  title,
  children,
}: {
  tone: 'success' | 'warning' | 'neutral';
  title: string;
  children: React.ReactNode;
}) {
  const color =
    tone === 'success'
      ? 'var(--color-status-success)'
      : tone === 'warning'
        ? 'var(--color-status-warning)'
        : 'var(--color-text-secondary)';
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
      }}
    >
      <p className="text-sm font-semibold" style={{ color }}>
        {title}
      </p>
      <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
        {children}
      </p>
    </div>
  );
}
