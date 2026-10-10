/**
 * KPI number formatting (overhaul Duty 1, Section 9.7).
 *
 * Long KPI values are shown in a compact form (`KES 1.2M`) so they cannot
 * overflow or wrap; the full grouped value is returned separately so the card
 * can expose it on hover/focus/tap.
 */
export function formatGrouped(value: number): string {
  return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(
    value,
  );
}

const COMPACT = new Intl.NumberFormat('en-KE', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export interface KpiNumber {
  /** Short display form, compacted above the threshold. */
  display: string;
  /** Full grouped value, always. */
  full: string;
}

export function formatKpiNumber(
  value: number,
  options: { compactFrom?: number } = {},
): KpiNumber {
  const compactFrom = options.compactFrom ?? 1_000_000;
  return {
    display:
      Math.abs(value) >= compactFrom
        ? COMPACT.format(value)
        : formatGrouped(value),
    full: formatGrouped(value),
  };
}
