'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import useSWR from 'swr';
import { format } from 'date-fns';
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Layers,
  Lock,
  MapPin,
} from 'lucide-react';
import { useMyOrganization } from '@/hooks/useMyOrganization';
import {
  getTaxAggregate,
  type TaxLocationSummary,
} from '@/services/tax.service';
import { formatCurrency } from '@/lib/utils';
import { taxPeriod } from '@/lib/tax-report';
import { deadlineLabel, isDeadlineUrgent } from '@/lib/tax-reconciliation';
import { ALL_LOCATIONS_LABEL, sumLocations } from '@/lib/tax-aggregation';

/**
 * Phase F — aggregated tax view across an org's locations. Reuses the existing
 * Growth multi-location capability (same gate as the ISP vertical's second
 * router); the location dimension comes from the existing `Router` (POP) and a
 * "Main location" fallback, not a tax-specific model. Strictly read-only, and
 * the grand total is derived from the per-location rows so no one adds them up
 * by hand.
 */
export default function TaxAggregatePage() {
  const { getToken } = useAuth();
  const { membership } = useMyOrganization();
  const organizationId = membership?.organization?.id ?? null;

  const [monthOffset, setMonthOffset] = useState(0);
  const period = useMemo(() => taxPeriod(monthOffset), [monthOffset]);

  const { data: report, isLoading, error } = useSWR(
    organizationId
      ? ['tax-aggregate', organizationId, period.from, period.to]
      : null,
    async () => {
      const token = await getToken();
      if (!token) return null;
      return getTaxAggregate(token, organizationId as string, {
        from: period.from,
        to: period.to,
      });
    },
  );

  const locations = report?.locations ?? [];
  const grandTotal = sumLocations(locations);
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
            <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              One tax summary aggregated across every location.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
            <Lock className="h-3.5 w-3.5" />
            Growth
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
          <p className="text-sm font-semibold">
            Multi-location is a Growth feature
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Upgrade to Growth to manage multiple locations and see their tax
            aggregated in one view.
          </p>
          <Link
            href="/paywall?feature=multi-location"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 text-sm font-semibold text-white"
          >
            See Growth
          </Link>
        </section>
      ) : error ? (
        <div className="rounded-2xl border border-[var(--color-status-critical)]/30 bg-[var(--color-status-critical)]/10 p-4 text-sm text-[var(--color-status-critical)]">
          Couldn&apos;t load the aggregated tax view. Nothing here is up to date
          until it loads.
        </div>
      ) : isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]" />
      ) : (
        <>
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
              {period.label} VAT filing deadline:{' '}
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
              icon={<MapPin className="h-4 w-4" />}
              label="Locations"
              value={String(report?.locationCount ?? 0)}
              accent="var(--color-text-secondary)"
            />
            <Tile
              icon={<BadgeCheck className="h-4 w-4" />}
              label="VAT filed"
              value={formatCurrency(grandTotal.taxAmount, 'KES')}
              accent="var(--color-status-success)"
            />
            <Tile
              icon={<Layers className="h-4 w-4" />}
              label="Awaiting filing"
              value={formatCurrency(grandTotal.pendingTaxAmount, 'KES')}
              accent="var(--color-status-warning)"
            />
          </section>

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
            <h2 className="text-base font-semibold">By location</h2>

            {locations.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
                No tax invoices for {period.label}.
              </p>
            ) : (
              <>
                <ul className="mt-4 divide-y divide-[var(--color-border)]">
                  {locations.map((location) => (
                    <LocationRow key={location.location} location={location} />
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--color-bg-base)] px-3 py-3">
                  <span className="text-sm font-semibold">
                    {ALL_LOCATIONS_LABEL}
                  </span>
                  <span className="text-sm font-bold">
                    {formatCurrency(grandTotal.taxAmount, 'KES')}
                    <span className="ml-2 text-xs font-normal text-[var(--color-text-secondary)]">
                      VAT filed
                    </span>
                  </span>
                </div>
                {locations.length < 2 && (
                  <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                    You currently have one location. Add another (for example a
                    new ISP router / POP) and its tax rolls in here
                    automatically.
                  </p>
                )}
              </>
            )}
          </section>
        </>
      )}

      <p className="text-center text-xs text-[var(--color-text-muted)]">
        Read-only. The total is computed from the locations above — nothing is
        entered or added up by hand.
      </p>
    </div>
  );
}

function LocationRow({ location }: { location: TaxLocationSummary }) {
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
          <span className="truncate">{location.location}</span>
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {location.invoiceCount} invoice
          {location.invoiceCount === 1 ? '' : 's'} · {location.filed} filed ·{' '}
          {location.pending} pending
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold">
          {formatCurrency(location.taxAmount, 'KES')}
        </p>
        {location.pendingTaxAmount > 0 && (
          <p className="text-xs text-[var(--color-status-warning)]">
            +{formatCurrency(location.pendingTaxAmount, 'KES')} pending
          </p>
        )}
      </div>
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
