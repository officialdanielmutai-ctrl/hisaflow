/**
 * Pure helpers for the Phase D Tax tab. Dependency-free (like the other lib
 * helpers) so the read-only display logic is testable, and so the tab's
 * no-data-entry guarantee can be asserted in `tax-report.test.ts`.
 */

export type TaxFilingStatus = 'PENDING' | 'SYNCED' | 'FAILED';
export type TaxFilingTone = 'active' | 'pending' | 'danger';

export interface TaxReportLine {
  status: TaxFilingStatus;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}

export interface TaxReportSummary {
  filed: number;
  pending: number;
  failed: number;
  taxableAmount: number;
  taxAmount: number;
  grossAmount: number;
  pendingTaxAmount: number;
}

export const TAX_TAB_READ_ONLY_NOTE =
  'This tab is read-only — tax is calculated and filed automatically at the point of sale.';

export function taxFilingStatusMeta(status: TaxFilingStatus): {
  label: string;
  tone: TaxFilingTone;
  description: string;
} {
  switch (status) {
    case 'SYNCED':
      return {
        label: 'Filed',
        tone: 'active',
        description: 'KRA has confirmed this invoice.',
      };
    case 'FAILED':
      return {
        label: 'Needs attention',
        tone: 'danger',
        description: 'KRA reported an error; the team has been alerted.',
      };
    default:
      return {
        label: 'Pending',
        tone: 'pending',
        description: 'Signed locally, waiting to reach KRA.',
      };
  }
}

/** Mirrors the backend summary so the tab can show totals from either source. */
export function summarizeTaxReport(lines: TaxReportLine[]): TaxReportSummary {
  const summary: TaxReportSummary = {
    filed: 0,
    pending: 0,
    failed: 0,
    taxableAmount: 0,
    taxAmount: 0,
    grossAmount: 0,
    pendingTaxAmount: 0,
  };

  for (const line of lines) {
    if (line.status === 'SYNCED') {
      summary.filed += 1;
      summary.taxableAmount += line.netAmount;
      summary.taxAmount += line.taxAmount;
      summary.grossAmount += line.grossAmount;
    } else if (line.status === 'FAILED') {
      summary.failed += 1;
    } else {
      summary.pending += 1;
      summary.pendingTaxAmount += line.taxAmount;
    }
  }

  summary.taxableAmount = round2(summary.taxableAmount);
  summary.taxAmount = round2(summary.taxAmount);
  summary.grossAmount = round2(summary.grossAmount);
  summary.pendingTaxAmount = round2(summary.pendingTaxAmount);
  return summary;
}

/** Calendar-month bounds for the period navigator (0 = current month). */
export function taxPeriod(
  monthOffset: number,
  now = new Date(),
): { from: string; to: string; label: string } {
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1),
  );
  const to = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1),
  );
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    label: `${from.toLocaleString('en-KE', {
      month: 'long',
      timeZone: 'UTC',
    })} ${from.getUTCFullYear()}`,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
