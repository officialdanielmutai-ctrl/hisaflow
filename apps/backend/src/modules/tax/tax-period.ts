import { BadRequestException } from '@nestjs/common';

/**
 * Shared tax-period helpers, used by the reconciliation (Phase E) and
 * multi-location aggregation (Phase F) views so the "filing period" and
 * "filing deadline" mean exactly the same thing everywhere.
 */

/** Kenyan VAT returns are due by the 20th of the month after the period. */
export const VAT_FILING_DEADLINE_DAY = 20;

export interface TaxPeriod {
  from: Date;
  to: Date;
  label: string;
}

export function buildPeriod(from: Date, to: Date): TaxPeriod {
  return {
    from,
    to,
    label: `${from.toLocaleString('en-KE', {
      month: 'long',
      timeZone: 'UTC',
    })} ${from.getUTCFullYear()}`,
  };
}

/** User-facing period; defaults to the current calendar month. */
export function resolvePeriod(range?: {
  from?: string;
  to?: string;
}): TaxPeriod {
  const now = new Date();
  const from = range?.from
    ? new Date(range.from)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = range?.to
    ? new Date(range.to)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException('Invalid period');
  }
  if (from.getTime() >= to.getTime()) {
    throw new BadRequestException('Invalid period: from must be before to');
  }

  return buildPeriod(from, to);
}

/** The single calendar month `offset` months from `now` (0 = current). */
export function monthPeriod(now: Date, offset = 0): TaxPeriod {
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1),
  );
  const to = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1),
  );
  return buildPeriod(from, to);
}

/**
 * VAT deadline for a period: the 20th of the month after the period ends.
 * `periodEnd` is the exclusive `to` (first of the following month).
 */
export function filingDeadlineFor(periodEnd: Date): Date {
  return new Date(
    Date.UTC(
      periodEnd.getUTCFullYear(),
      periodEnd.getUTCMonth(),
      VAT_FILING_DEADLINE_DAY,
    ),
  );
}

export function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
