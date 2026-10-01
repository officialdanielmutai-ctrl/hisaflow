import { Prisma, TaxInvoiceStatus } from '@prisma/client';
import { TaxDbClient } from './tax-client';
import { TaxFilingService } from './tax-filing.service';

function dec(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function build(opts: {
  taxTotal: string;
  existingStatus?: TaxInvoiceStatus | null;
}) {
  const invoice = {
    id: 'inv_1',
    organizationId: 'org_1',
    roomTotal: dec(1160),
    consumptionTotal: dec(0),
    adjustmentsTotal: dec(0),
    taxTotal: dec(opts.taxTotal),
    lineItems: [],
  };

  const existing = opts.existingStatus
    ? {
        id: 'rec_1',
        invoiceId: 'inv_1',
        organizationId: 'org_1',
        status: opts.existingStatus,
      }
    : null;

  const recordUpsert = jest.fn(
    async ({ create }: { create: Record<string, unknown> }) => ({
      id: 'rec_1',
      status: opts.existingStatus ?? TaxInvoiceStatus.PENDING,
      ...create,
    }),
  );
  const queueUpsert = jest.fn(async () => ({}));

  const client = {
    invoice: { findUniqueOrThrow: jest.fn(async () => invoice) },
    taxInvoiceRecord: {
      findUnique: jest.fn(async () => existing),
      upsert: recordUpsert,
    },
    taxSyncQueue: { upsert: queueUpsert },
  } as unknown as TaxDbClient;

  return {
    service: new TaxFilingService(),
    client,
    recordUpsert,
    queueUpsert,
  };
}

describe('TaxFilingService (Phase C)', () => {
  it('records the invoice tax split and enqueues it for filing', async () => {
    const { service, client, recordUpsert, queueUpsert } = build({
      taxTotal: '160',
    });

    await service.ensureRecord(client, 'inv_1');

    const create = recordUpsert.mock.calls[0][0] as {
      create: Record<string, Prisma.Decimal>;
    };
    expect(create.create.netAmount.toString()).toBe('1000');
    expect(create.create.taxAmount.toString()).toBe('160');
    expect(create.create.grossAmount.toString()).toBe('1160');
    expect(create.create.taxRate.toString()).toBe('0.16');
    expect(queueUpsert).toHaveBeenCalledTimes(1);
  });

  it('ignores a tax-free invoice that has never been filed', async () => {
    const { service, client, recordUpsert, queueUpsert } = build({
      taxTotal: '0',
    });

    const result = await service.ensureRecord(client, 'inv_1');

    expect(result).toBeNull();
    expect(recordUpsert).not.toHaveBeenCalled();
    expect(queueUpsert).not.toHaveBeenCalled();
  });

  it('does not re-queue an already-synced record', async () => {
    const { service, client, queueUpsert } = build({
      taxTotal: '160',
      existingStatus: TaxInvoiceStatus.SYNCED,
    });

    await service.ensureRecord(client, 'inv_1');

    expect(queueUpsert).not.toHaveBeenCalled();
  });
});
