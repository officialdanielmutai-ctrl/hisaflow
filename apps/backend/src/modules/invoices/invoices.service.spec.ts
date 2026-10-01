import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { InvoiceTaxService } from '../tax/invoice-tax.service';
import { TaxFilingService } from '../tax/tax-filing.service';
import { InvoicesService } from './invoices.service';

interface Seed {
  registered: boolean;
  ratePerNight?: string;
}

function build(seed: Seed) {
  const invoiceCreate = jest.fn(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'inv_1',
      ...data,
    }),
  );
  const bookingFindFirst = jest.fn(async () => ({
    id: 'bk_1',
    organizationId: 'org_1',
    actualCheckIn: null,
    checkInDate: new Date('2026-01-01T00:00:00.000Z'),
    actualCheckOut: null,
    checkOutDate: new Date('2026-01-02T00:00:00.000Z'),
    ratePerNight: new Prisma.Decimal(seed.ratePerNight ?? '1160'),
    consumptions: [],
    invoice: null,
  }));

  const prisma = {
    db: {
      booking: { findFirst: bookingFindFirst },
      invoice: { create: invoiceCreate },
      taxRegistration: {
        findUnique: jest.fn(async () =>
          seed.registered ? { id: 'tr_1' } : null,
        ),
      },
    },
  };

  const taxService = new InvoiceTaxService({
    ensureRecord: jest.fn(),
  } as unknown as TaxFilingService);
  const service = new InvoicesService(
    prisma as unknown as PrismaService,
    taxService,
  );

  return { service, invoiceCreate };
}

describe('InvoicesService auto tax (Phase B)', () => {
  it('creates a booking invoice with tax calculated, zero manual entry', async () => {
    const { service, invoiceCreate } = build({ registered: true });

    await service.getDraftForBooking('org_1', 'bk_1');

    const arg = invoiceCreate.mock.calls[0][0] as {
      data: { taxTotal: Prisma.Decimal; roomTotal: Prisma.Decimal };
    };
    expect(arg.data.roomTotal.toString()).toBe('1160');
    expect(arg.data.taxTotal.toString()).toBe('160');
  });

  it('creates the same invoice with zero tax for a non-registered org', async () => {
    const { service, invoiceCreate } = build({ registered: false });

    await service.getDraftForBooking('org_1', 'bk_1');

    const arg = invoiceCreate.mock.calls[0][0] as {
      data: { taxTotal: Prisma.Decimal };
    };
    expect(arg.data.taxTotal.toString()).toBe('0');
  });
});
