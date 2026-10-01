/**
 * Pure helpers for the Phase F multi-location aggregation view. They let the
 * dashboard show a grand total derived from the per-location rows, so nobody
 * adds locations up by hand — the "Done when" for this layer.
 */

export interface AggregatableLocation {
  location: string;
  invoiceCount: number;
  filed: number;
  pending: number;
  failed: number;
  taxableAmount: number;
  taxAmount: number;
  grossAmount: number;
  pendingTaxAmount: number;
}

export const ALL_LOCATIONS_LABEL = 'All locations';

export function sumLocations(
  locations: AggregatableLocation[],
): AggregatableLocation {
  const total = locations.reduce<AggregatableLocation>(
    (acc, location) => ({
      location: ALL_LOCATIONS_LABEL,
      invoiceCount: acc.invoiceCount + location.invoiceCount,
      filed: acc.filed + location.filed,
      pending: acc.pending + location.pending,
      failed: acc.failed + location.failed,
      taxableAmount: acc.taxableAmount + location.taxableAmount,
      taxAmount: acc.taxAmount + location.taxAmount,
      grossAmount: acc.grossAmount + location.grossAmount,
      pendingTaxAmount: acc.pendingTaxAmount + location.pendingTaxAmount,
    }),
    {
      location: ALL_LOCATIONS_LABEL,
      invoiceCount: 0,
      filed: 0,
      pending: 0,
      failed: 0,
      taxableAmount: 0,
      taxAmount: 0,
      grossAmount: 0,
      pendingTaxAmount: 0,
    },
  );

  return {
    ...total,
    taxableAmount: round2(total.taxableAmount),
    taxAmount: round2(total.taxAmount),
    grossAmount: round2(total.grossAmount),
    pendingTaxAmount: round2(total.pendingTaxAmount),
  };
}

/** Cross-check that the API's grand total equals the sum of its locations. */
export function totalsMatchLocations(
  locations: AggregatableLocation[],
  totals: AggregatableLocation,
): boolean {
  const summed = sumLocations(locations);
  return (
    summed.invoiceCount === totals.invoiceCount &&
    summed.filed === totals.filed &&
    summed.pending === totals.pending &&
    summed.failed === totals.failed &&
    Math.abs(summed.taxAmount - totals.taxAmount) < 0.01 &&
    Math.abs(summed.pendingTaxAmount - totals.pendingTaxAmount) < 0.01
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
