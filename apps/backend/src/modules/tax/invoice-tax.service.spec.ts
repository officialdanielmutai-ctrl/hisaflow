import { Prisma } from '@prisma/client';
import { InvoiceTaxService } from './invoice-tax.service';
import { TaxFilingService } from './tax-filing.service';

interface BuildSeed {
  registered?: boolean;
  roomTotal?: string;
  consumptionTotal?: string;
  lineTaxSum?: string;
}

function build(seed: BuildSeed = {}) {
  const registered = seed.registered ?? false;

  const invoiceCreate = jest.fn(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'inv_1',
      ...data,
    }),
  );
  const invoiceUpdate = jest.fn(async (_args: unknown) => ({ id: 'inv_1' }));
  const invoiceFindUniqueOrThrow = jest.fn(async () => ({
    organizationId: 'org_1',
    roomTotal: new Prisma.Decimal(seed.roomTotal ?? '0'),
    consumptionTotal: new Prisma.Decimal(seed.consumptionTotal ?? '0'),
  }));
  const lineCreate = jest.fn(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'line_1',
      ...data,
    }),
  );
  const lineAggregate = jest.fn(async () => ({
    _sum: { taxAmount: new Prisma.Decimal(seed.lineTaxSum ?? '0') },
  }));
  const registrationFindUnique = jest.fn(async () =>
    registered ? { id: 'tr_1' } : null,
  );
  const ensureRecord = jest.fn(async () => null);

  const client = {
    invoice: {
      create: invoiceCreate,
      update: invoiceUpdate,
      findUniqueOrThrow: invoiceFindUniqueOrThrow,
    },
    invoiceLineItem: {
      create: lineCreate,
      aggregate: lineAggregate,
    },
    taxRegistration: { findUnique: registrationFindUnique },
  };

  const service = new InvoiceTaxService({
    ensureRecord,
  } as unknown as TaxFilingService);
  return {
    service,
    client: client as never,
    invoiceCreate,
    invoiceUpdate,
    lineCreate,
    lineAggregate,
    ensureRecord,
  };
}

describe('InvoiceTaxService (Phase B)', () => {
  describe('createInvoice', () => {
    it('writes taxTotal 0 for a non-tax-registered org', async () => {
      const { service, client, invoiceCreate } = build({ registered: false });

      await service.createInvoice(client, {
        data: {
          organizationId: 'org_1',
          roomTotal: new Prisma.Decimal(1160),
          consumptionTotal: new Prisma.Decimal(0),
          status: 'DRAFT',
        },
      });

      expect(invoiceCreate).toHaveBeenCalledTimes(1);
      const arg = invoiceCreate.mock.calls[0][0] as {
        data: { taxTotal: Prisma.Decimal };
      };
      expect(arg.data.taxTotal.toString()).toBe('0');
    });

    it('computes taxTotal from the tax-inclusive totals for a registered org', async () => {
      const { service, client, invoiceCreate } = build({ registered: true });

      await service.createInvoice(client, {
        data: {
          organizationId: 'org_1',
          roomTotal: new Prisma.Decimal(1160),
          consumptionTotal: new Prisma.Decimal(0),
          adjustmentsTotal: new Prisma.Decimal(0),
          status: 'DRAFT',
        },
      });

      const arg = invoiceCreate.mock.calls[0][0] as {
        data: { taxTotal: Prisma.Decimal };
      };
      expect(arg.data.taxTotal.toString()).toBe('160');
    });
    it('records the invoice for eTIMS filing when the org is registered', async () => {
      const { service, client, ensureRecord } = build({ registered: true });

      await service.createInvoice(client, {
        data: {
          organizationId: 'org_1',
          roomTotal: new Prisma.Decimal(1160),
          consumptionTotal: new Prisma.Decimal(0),
          adjustmentsTotal: new Prisma.Decimal(0),
          status: 'DRAFT',
        },
      });

      expect(ensureRecord).toHaveBeenCalledWith(client, 'inv_1');
    });

    it('does not record a filing for a non-registered org', async () => {
      const { service, client, ensureRecord } = build({ registered: false });

      await service.createInvoice(client, {
        data: {
          organizationId: 'org_1',
          roomTotal: new Prisma.Decimal(1160),
          consumptionTotal: new Prisma.Decimal(0),
          status: 'DRAFT',
        },
      });

      expect(ensureRecord).not.toHaveBeenCalled();
    });
  });

  describe('createLineItem', () => {
    it('stores the net/tax split and updates the invoice totals', async () => {
      const {
        service,
        client,
        lineCreate,
        invoiceUpdate,
      } = build({ registered: true, lineTaxSum: '160' });

      const line = await service.createLineItem(client, {
        invoiceId: 'inv_1',
        description: 'Room charge',
        quantity: new Prisma.Decimal(1),
        unitPrice: new Prisma.Decimal(1160),
        total: new Prisma.Decimal(1160),
      });

      expect(lineCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            netAmount: expect.anything(),
            taxAmount: expect.anything(),
            taxRate: expect.anything(),
          }),
        }),
      );
      expect((line as { taxAmount: Prisma.Decimal }).taxAmount.toString()).toBe(
        '160',
      );
      // adjustmentsTotal is incremented by the factory now (callers no longer do it)
      expect(invoiceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adjustmentsTotal: { increment: expect.anything() },
            taxTotal: expect.anything(),
          }),
        }),
      );
    });

    it('adds tax on the non-itemised base to the line tax', async () => {
      const { service, client, invoiceUpdate } = build({
        registered: true,
        roomTotal: '1160',
        lineTaxSum: '160',
      });

      await service.createLineItem(client, {
        invoiceId: 'inv_1',
        description: 'Extra',
        quantity: new Prisma.Decimal(1),
        unitPrice: new Prisma.Decimal(1160),
        total: new Prisma.Decimal(1160),
      });

      const arg = invoiceUpdate.mock.calls[0][0] as {
        data: { taxTotal: Prisma.Decimal };
      };
      // 160 (room) + 160 (line) = 320
      expect(arg.data.taxTotal.toString()).toBe('320');
    });

    it('writes zero tax and skips aggregation for an unregistered org', async () => {
      const { service, client, lineCreate, lineAggregate, invoiceUpdate } = build(
        { registered: false },
      );

      await service.createLineItem(client, {
        invoiceId: 'inv_1',
        description: 'Room charge',
        quantity: new Prisma.Decimal(1),
        unitPrice: new Prisma.Decimal(1160),
        total: new Prisma.Decimal(1160),
      });

      const arg = lineCreate.mock.calls[0][0] as {
        data: { taxAmount: Prisma.Decimal; netAmount: Prisma.Decimal };
      };
      expect(arg.data.taxAmount.toString()).toBe('0');
      expect(arg.data.netAmount.toString()).toBe('1160');
      expect(lineAggregate).not.toHaveBeenCalled();
      expect(invoiceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taxTotal: expect.anything(),
          }),
        }),
      );
    });
  });
});
