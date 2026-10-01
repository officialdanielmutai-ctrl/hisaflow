/**
 * Phase F — multi-branch (multi-location) tax aggregation.
 *
 * This deliberately does **not** introduce a tax-specific location model. The
 * "location" is derived from the existing multi-location capability: an ISP
 * POP is a `Router` (Section 1's "multiple ISP Router POPs"), reached via
 * `Invoice.subscriber.router`. Anything without a router aggregates under a
 * single main location, so the same view works for guest-house/retail and can
 * absorb guest-house properties when that lands.
 */

export type TaxLocationStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export interface TaxLocationRecord {
  location: string;
  status: TaxLocationStatus;
  netAmount: number;
  taxAmount: number;
  grossAmount: number;
}

export interface TaxLocationSummary {
  location: string;
  invoiceCount: number;
  filed: number;
  pending: number;
  failed: number;
  /** Taxable value / tax / gross of invoices KRA has confirmed here. */
  taxableAmount: number;
  taxAmount: number;
  grossAmount: number;
  /** Tax signed/queued but not yet confirmed by KRA. */
  pendingTaxAmount: number;
}

export const UNASSIGNED_LOCATION = 'Main location';

export function emptyLocationSummary(location: string): TaxLocationSummary {
  return {
    location,
    invoiceCount: 0,
    filed: 0,
    pending: 0,
    failed: 0,
    taxableAmount: 0,
    taxAmount: 0,
    grossAmount: 0,
    pendingTaxAmount: 0,
  };
}

/**
 * Group tax invoices by location and roll them up. The grand total is computed
 * automatically from the groups, so nobody has to add locations up by hand.
 */
export function aggregateByLocation(records: TaxLocationRecord[]): {
  locations: TaxLocationSummary[];
  totals: TaxLocationSummary;
} {
  const groups = new Map<string, TaxLocationSummary>();

  for (const record of records) {
    const group =
      groups.get(record.location) ?? emptyLocationSummary(record.location);
    group.invoiceCount += 1;

    if (record.status === 'SYNCED') {
      group.filed += 1;
      group.taxableAmount += record.netAmount;
      group.taxAmount += record.taxAmount;
      group.grossAmount += record.grossAmount;
    } else if (record.status === 'FAILED') {
      group.failed += 1;
    } else {
      group.pending += 1;
      group.pendingTaxAmount += record.taxAmount;
    }

    groups.set(record.location, group);
  }

  const locations = [...groups.values()]
    .map(roundSummary)
    .sort(
      (a, b) =>
        b.grossAmount - a.grossAmount || a.location.localeCompare(b.location),
    );

  const totals = roundSummary(
    locations.reduce(
      (acc, location) => mergeSummary(acc, location),
      emptyLocationSummary('All locations'),
    ),
  );

  return { locations, totals };
}

function mergeSummary(
  a: TaxLocationSummary,
  b: TaxLocationSummary,
): TaxLocationSummary {
  return {
    location: a.location,
    invoiceCount: a.invoiceCount + b.invoiceCount,
    filed: a.filed + b.filed,
    pending: a.pending + b.pending,
    failed: a.failed + b.failed,
    taxableAmount: a.taxableAmount + b.taxableAmount,
    taxAmount: a.taxAmount + b.taxAmount,
    grossAmount: a.grossAmount + b.grossAmount,
    pendingTaxAmount: a.pendingTaxAmount + b.pendingTaxAmount,
  };
}

function roundSummary(summary: TaxLocationSummary): TaxLocationSummary {
  return {
    ...summary,
    taxableAmount: round2(summary.taxableAmount),
    taxAmount: round2(summary.taxAmount),
    grossAmount: round2(summary.grossAmount),
    pendingTaxAmount: round2(summary.pendingTaxAmount),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
