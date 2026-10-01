/**
 * Phase E — reconciliation & anomaly detection (Team-tier depth).
 *
 * Pure comparison of what KRA has actually accepted against the sales that
 * should have been filed. Kept dependency-free so the "deliberately introduced
 * mismatch is flagged" behaviour is directly unit-testable.
 */

export type TaxAnomalyType =
  /** A completed, tax-bearing sale with no eTIMS filing record at all. */
  | 'SALE_NOT_FILED'
  /** A sale whose filing record is failed, or still pending past the grace window. */
  | 'SALE_NOT_SYNCED'
  /** KRA-confirmed tax does not match the invoice's calculated tax. */
  | 'FILED_AMOUNT_MISMATCH'
  /** A filing exists for something that is not a completed sale (draft/voided). */
  | 'FILED_FOR_NON_SALE';

export type TaxAnomalySeverity = 'warning' | 'critical';

export interface ExpectedSale {
  invoiceId: string;
  invoiceStatus: string;
  /** Tax calculated on the invoice (what should have been filed). */
  taxTotal: number;
}

export interface FiledInvoiceRecord {
  invoiceId: string;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  /** Tax recorded on the filing (what KRA accepted). */
  taxAmount: number;
  invoiceStatus: string;
  createdAt: Date;
}

export interface TaxAnomaly {
  /** Stable key for alert de-duplication across runs. */
  key: string;
  type: TaxAnomalyType;
  invoiceId: string;
  severity: TaxAnomalySeverity;
  message: string;
  expectedTaxAmount: number | null;
  filedTaxAmount: number | null;
}

/** A signed-but-unsent invoice is only anomalous after this long. */
export const RECONCILIATION_STUCK_AFTER_MS = 24 * 60 * 60 * 1000;
/** Tolerance for tax-amount comparison (a cent). */
export const RECONCILIATION_AMOUNT_TOLERANCE = 0.01;

export function detectTaxAnomalies(input: {
  expectedSales: ExpectedSale[];
  filedRecords: FiledInvoiceRecord[];
  now: Date;
  stuckAfterMs?: number;
  tolerance?: number;
}): TaxAnomaly[] {
  const stuckAfter = input.stuckAfterMs ?? RECONCILIATION_STUCK_AFTER_MS;
  const tolerance = input.tolerance ?? RECONCILIATION_AMOUNT_TOLERANCE;

  const recordByInvoice = new Map(
    input.filedRecords.map((record) => [record.invoiceId, record]),
  );
  const expectedIds = new Set(input.expectedSales.map((sale) => sale.invoiceId));
  const anomalies: TaxAnomaly[] = [];
  const seen = new Set<string>();

  const push = (anomaly: TaxAnomaly) => {
    if (!seen.has(anomaly.key)) {
      seen.add(anomaly.key);
      anomalies.push(anomaly);
    }
  };

  for (const sale of input.expectedSales) {
    const record = recordByInvoice.get(sale.invoiceId);

    if (!record) {
      push({
        key: `SALE_NOT_FILED:${sale.invoiceId}`,
        type: 'SALE_NOT_FILED',
        invoiceId: sale.invoiceId,
        severity: 'critical',
        message: `Sale ${shortId(sale.invoiceId)} is complete but has no eTIMS filing record.`,
        expectedTaxAmount: sale.taxTotal,
        filedTaxAmount: null,
      });
      continue;
    }

    if (record.status === 'FAILED') {
      push({
        key: `SALE_NOT_SYNCED:${sale.invoiceId}`,
        type: 'SALE_NOT_SYNCED',
        invoiceId: sale.invoiceId,
        severity: 'critical',
        message: `Filing for sale ${shortId(sale.invoiceId)} failed and never reached KRA.`,
        expectedTaxAmount: sale.taxTotal,
        filedTaxAmount: record.taxAmount,
      });
      continue;
    }

    const age = input.now.getTime() - record.createdAt.getTime();
    if (record.status === 'PENDING' && age >= stuckAfter) {
      push({
        key: `SALE_NOT_SYNCED:${sale.invoiceId}`,
        type: 'SALE_NOT_SYNCED',
        invoiceId: sale.invoiceId,
        severity: 'warning',
        message: `Filing for sale ${shortId(sale.invoiceId)} has been pending for ${Math.floor(
          age / (60 * 60 * 1000),
        )}h and has not reached KRA.`,
        expectedTaxAmount: sale.taxTotal,
        filedTaxAmount: record.taxAmount,
      });
      continue;
    }

    if (
      record.status === 'SYNCED' &&
      Math.abs(record.taxAmount - sale.taxTotal) > tolerance
    ) {
      push({
        key: `FILED_AMOUNT_MISMATCH:${sale.invoiceId}`,
        type: 'FILED_AMOUNT_MISMATCH',
        invoiceId: sale.invoiceId,
        severity: 'critical',
        message: `Filed tax for sale ${shortId(sale.invoiceId)} (${record.taxAmount}) does not match the invoice's calculated tax (${sale.taxTotal}).`,
        expectedTaxAmount: sale.taxTotal,
        filedTaxAmount: record.taxAmount,
      });
    }
  }

  for (const record of input.filedRecords) {
    if (expectedIds.has(record.invoiceId)) continue;
    if (record.status === 'SYNCED') {
      push({
        key: `FILED_FOR_NON_SALE:${record.invoiceId}`,
        type: 'FILED_FOR_NON_SALE',
        invoiceId: record.invoiceId,
        severity: 'warning',
        message: `A filing exists for ${shortId(record.invoiceId)}, which is not a completed sale (${record.invoiceStatus}).`,
        expectedTaxAmount: null,
        filedTaxAmount: record.taxAmount,
      });
    }
  }

  return anomalies;
}

function shortId(invoiceId: string): string {
  return `#${invoiceId.slice(-6)}`;
}

/**
 * Recover the invoice id from an anomaly key (`TYPE:invoiceId`). The scheduled
 * run uses this to tell whether an existing alert's invoice was re-checked this
 * run, so it never silently clears an alert for a period it did not examine.
 */
export function invoiceIdFromAnomalyKey(
  itemId: string | null | undefined,
): string | null {
  if (!itemId) return null;
  const separator = itemId.indexOf(':');
  if (separator < 0) return null;
  const invoiceId = itemId.slice(separator + 1);
  return invoiceId.length > 0 ? invoiceId : null;
}
