import {
  detectTaxAnomalies,
  ExpectedSale,
  FiledInvoiceRecord,
  invoiceIdFromAnomalyKey,
} from './tax-reconciliation';

function sale(invoiceId: string, taxTotal: number): ExpectedSale {
  return { invoiceId, invoiceStatus: 'ISSUED', taxTotal };
}

function filed(
  invoiceId: string,
  overrides: Partial<FiledInvoiceRecord> = {},
): FiledInvoiceRecord {
  return {
    invoiceId,
    status: 'SYNCED',
    taxAmount: 160,
    invoiceStatus: 'ISSUED',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('detectTaxAnomalies (Phase E)', () => {
  it('flags a deliberately blocked sync as an anomaly', () => {
    const now = new Date('2026-09-15T00:00:00.000Z');
    const anomalies = detectTaxAnomalies({
      expectedSales: [sale('inv_blocked', 160)],
      filedRecords: [
        // Signed but never reached KRA, well past the grace window.
        filed('inv_blocked', {
          status: 'PENDING',
          createdAt: new Date('2026-09-10T00:00:00.000Z'),
        }),
      ],
      now,
    });

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({
      type: 'SALE_NOT_SYNCED',
      invoiceId: 'inv_blocked',
      key: 'SALE_NOT_SYNCED:inv_blocked',
    });
  });

  it('passes a correctly filed period with no anomalies', () => {
    const anomalies = detectTaxAnomalies({
      expectedSales: [sale('inv_ok', 160)],
      filedRecords: [filed('inv_ok')],
      now: new Date('2026-09-15T00:00:00.000Z'),
    });

    expect(anomalies).toEqual([]);
  });

  it('does not flag a recently-signed pending invoice (still in grace)', () => {
    const anomalies = detectTaxAnomalies({
      expectedSales: [sale('inv_new', 160)],
      filedRecords: [
        filed('inv_new', {
          status: 'PENDING',
          createdAt: new Date('2026-09-15T00:00:00.000Z'),
        }),
      ],
      now: new Date('2026-09-15T02:00:00.000Z'),
    });

    expect(anomalies).toEqual([]);
  });

  it('flags a completed sale with no filing record at all', () => {
    const anomalies = detectTaxAnomalies({
      expectedSales: [sale('inv_missing', 320)],
      filedRecords: [],
      now: new Date('2026-09-15T00:00:00.000Z'),
    });

    expect(anomalies[0].type).toBe('SALE_NOT_FILED');
    expect(anomalies[0].severity).toBe('critical');
    expect(anomalies[0].expectedTaxAmount).toBe(320);
  });

  it('flags a failed filing', () => {
    const anomalies = detectTaxAnomalies({
      expectedSales: [sale('inv_failed', 160)],
      filedRecords: [filed('inv_failed', { status: 'FAILED' })],
      now: new Date('2026-09-15T00:00:00.000Z'),
    });

    expect(anomalies[0].type).toBe('SALE_NOT_SYNCED');
    expect(anomalies[0].severity).toBe('critical');
  });

  it('flags filed tax that does not match the calculated tax', () => {
    const anomalies = detectTaxAnomalies({
      expectedSales: [sale('inv_diff', 160)],
      filedRecords: [filed('inv_diff', { taxAmount: 200 })],
      now: new Date('2026-09-15T00:00:00.000Z'),
    });

    expect(anomalies[0].type).toBe('FILED_AMOUNT_MISMATCH');
    expect(anomalies[0].expectedTaxAmount).toBe(160);
    expect(anomalies[0].filedTaxAmount).toBe(200);
  });

  it('flags a filing for something that is not a completed sale', () => {
    const anomalies = detectTaxAnomalies({
      expectedSales: [],
      filedRecords: [filed('inv_draft', { invoiceStatus: 'DRAFT' })],
      now: new Date('2026-09-15T00:00:00.000Z'),
    });

    expect(anomalies[0].type).toBe('FILED_FOR_NON_SALE');
  });

  it('recovers the invoice id from an anomaly key', () => {
    expect(invoiceIdFromAnomalyKey('SALE_NOT_FILED:inv_123')).toBe('inv_123');
    expect(invoiceIdFromAnomalyKey('FILED_AMOUNT_MISMATCH:inv_abc')).toBe(
      'inv_abc',
    );
    expect(invoiceIdFromAnomalyKey(null)).toBeNull();
    expect(invoiceIdFromAnomalyKey('no-separator')).toBeNull();
  });
});
