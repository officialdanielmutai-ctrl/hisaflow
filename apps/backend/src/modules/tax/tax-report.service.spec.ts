import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { TaxReportService } from './tax-report.service';

function dec(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec_1',
    organizationId: 'org_1',
    invoiceId: 'inv_1',
    status: 'SYNCED',
    currency: 'KES',
    netAmount: dec(1000),
    taxAmount: dec(160),
    grossAmount: dec(1160),
    taxRate: dec('0.16'),
    vscuReceiptNumber: '27',
    vscuInternalData: 'INT',
    vscuReceiptSignature: 'SIG',
    signedAt: new Date('2026-09-10T09:00:00.000Z'),
    kraInvoiceNumber: 'KRA-27',
    syncedAt: new Date('2026-09-10T09:01:00.000Z'),
    lastError: null,
    createdAt: new Date('2026-09-10T08:00:00.000Z'),
    syncQueue: null,
    invoice: { status: 'ISSUED' },
    ...overrides,
  };
}

function build(seed: {
  registration?: Record<string, unknown> | null;
  records?: Record<string, unknown>[];
}) {
  const findMany = jest.fn(async () => seed.records ?? []);
  const prisma = {
    db: {
      taxRegistration: {
        findUnique: jest.fn(async () => seed.registration ?? null),
      },
      taxInvoiceRecord: { findMany },
    },
  } as unknown as PrismaService;
  return { service: new TaxReportService(prisma), findMany };
}

const period = { from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' };

describe('TaxReportService (Phase D)', () => {
  it('summarises filed vs pending tax for the period, read-only', async () => {
    const { service } = build({
      registration: { status: 'PRODUCTION_ACTIVE', kraPin: 'P051234567X' },
      records: [
        makeRecord(),
        makeRecord({ id: 'rec_2', invoiceId: 'inv_2' }),
        makeRecord({
          id: 'rec_3',
          invoiceId: 'inv_3',
          status: 'PENDING',
          netAmount: dec(2000),
          taxAmount: dec(320),
          grossAmount: dec(2320),
          signedAt: null,
          kraInvoiceNumber: null,
          syncedAt: null,
          syncQueue: {
            status: 'PENDING',
            attempts: 2,
            kraErrorCount: 0,
            nextAttemptAt: new Date('2026-09-30T10:00:00.000Z'),
            lastError: 'fetch failed',
            lastErrorClass: 'NETWORK_OFFLINE',
          },
        }),
      ],
    });

    const report = await service.getReport('org_1', period);

    expect(report.registration).toEqual({
      status: 'PRODUCTION_ACTIVE',
      canFileLive: true,
    });
    expect(report.summary.filed).toBe(2);
    expect(report.summary.taxableAmount).toBe(2000);
    expect(report.summary.taxAmount).toBe(320);
    expect(report.summary.grossAmount).toBe(2320);
    expect(report.summary.pending).toBe(1);
    expect(report.summary.pendingTaxAmount).toBe(320);
    expect(report.invoices).toHaveLength(3);
    expect(report.invoices[2]).toMatchObject({
      invoiceId: 'inv_3',
      signed: false,
      syncStatus: 'PENDING',
      lastErrorClass: 'NETWORK_OFFLINE',
    });
  });

  it('excludes voided invoices from the filing obligation', async () => {
    const { service, findMany } = build({ records: [] });

    await service.getReport('org_1', period);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          invoice: { status: { not: 'VOIDED' } },
        }),
      }),
    );
  });

  it('rejects an inverted period', async () => {
    const { service } = build({ records: [] });

    await expect(
      service.getReport('org_1', {
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-09-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
