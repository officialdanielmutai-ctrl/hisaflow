/**
 * Pure helpers for the Phase E reconciliation dashboard. Dependency-free so the
 * anomaly presentation/deadline logic is testable and the dashboard's
 * read-only guarantee can be asserted in `tax-reconciliation.test.ts`.
 */

export type TaxAnomalyType =
  | 'SALE_NOT_FILED'
  | 'SALE_NOT_SYNCED'
  | 'FILED_AMOUNT_MISMATCH'
  | 'FILED_FOR_NON_SALE';

export type TaxAnomalySeverity = 'warning' | 'critical';

export interface TaxAnomalyLike {
  type: TaxAnomalyType;
  severity: TaxAnomalySeverity;
}

export const TAX_ANOMALY_META: Record<
  TaxAnomalyType,
  { label: string; description: string }
> = {
  SALE_NOT_FILED: {
    label: 'Sale not filed',
    description: 'A completed sale has no eTIMS filing record.',
  },
  SALE_NOT_SYNCED: {
    label: 'Filing not confirmed',
    description: 'A filing is failed or has been pending past the grace window.',
  },
  FILED_AMOUNT_MISMATCH: {
    label: 'Tax amount mismatch',
    description: "Filed tax does not match the invoice's calculated tax.",
  },
  FILED_FOR_NON_SALE: {
    label: 'Filed for a non-sale',
    description: 'A filing exists for a draft or voided invoice.',
  },
};

export function taxAnomalyMeta(type: TaxAnomalyType): {
  label: string;
  description: string;
} {
  return (
    TAX_ANOMALY_META[type] ?? { label: type, description: '' }
  );
}

export function summarizeAnomalies(anomalies: TaxAnomalyLike[]): {
  total: number;
  critical: number;
  warning: number;
} {
  return {
    total: anomalies.length,
    critical: anomalies.filter((a) => a.severity === 'critical').length,
    warning: anomalies.filter((a) => a.severity === 'warning').length,
  };
}

/** Human copy for the filing deadline; negative days means it has passed. */
export function deadlineLabel(daysUntilDeadline: number): string {
  if (daysUntilDeadline < 0) {
    const overdue = Math.abs(daysUntilDeadline);
    return `Overdue by ${overdue} day${overdue === 1 ? '' : 's'}`;
  }
  if (daysUntilDeadline === 0) return 'Due today';
  return `Due in ${daysUntilDeadline} day${daysUntilDeadline === 1 ? '' : 's'}`;
}

export function isDeadlineUrgent(daysUntilDeadline: number): boolean {
  return daysUntilDeadline <= 7;
}
