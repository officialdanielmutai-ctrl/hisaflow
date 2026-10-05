import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { InvoiceTaxService } from '../../tax/invoice-tax.service';
import { RouterActionService } from '../routers/router-action.service';
import { IspInvoicesService } from './isp-invoices.service';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function build(
  opts: {
    subscriberFound?: boolean;
    plan?: any;
    invoice?: any;
    totalDue?: number;
  } = {},
) {
  const subscriber = {
    findFirst: jest.fn(async (args: any) =>
      (opts.subscriberFound ?? true) && args?.where?.organizationId === ORG
        ? { id: 'sub_1', organizationId: ORG, planId: 'plan_1' }
        : null,
    ),
  };
  const servicePlan = {
    findFirst: jest.fn(async (args: any) =>
      args?.where?.organizationId === ORG
        ? opts.plan ?? {
            id: 'plan_1',
            name: 'Home 10Mbps',
            price: new Prisma.Decimal('3000'),
            billingCycle: 'MONTHLY',
          }
        : null,
    ),
  };

  const state = {
    amountPaid: Number(opts.invoice?.amountPaid ?? 0),
    status: opts.invoice?.status ?? InvoiceStatus.DRAFT,
  };
  const totalDue = opts.totalDue ?? 0;

  const invoice = {
    findMany: jest.fn(async () => []),
    findFirst: jest.fn(async (args: any) =>
      args?.where?.organizationId === ORG
        ? opts.invoice ?? {
            id: 'inv_1',
            organizationId: ORG,
            subscriberId: 'sub_1',
            status: InvoiceStatus.DRAFT,
            adjustmentsTotal: 0,
            consumptionTotal: 0,
            roomTotal: 0,
            amountPaid: 0,
            suspendedForNonPayment: false,
          }
        : null,
    ),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };

  const txInvoice = {
    findUnique: jest.fn(async () => ({ id: 'inv_1', lineItems: [], payments: [], plan: null })),
    findUniqueOrThrow: jest.fn(async () => ({ id: 'inv_1', lineItems: [] })),
    update: jest.fn(async ({ where, data }: any) => {
      if (data.amountPaid?.increment !== undefined) {
        state.amountPaid += Number(data.amountPaid.increment);
      }
      if (data.status) state.status = data.status;
      return {
        id: where.id,
        status: state.status,
        adjustmentsTotal: 0,
        consumptionTotal: totalDue,
        roomTotal: 0,
        amountPaid: state.amountPaid,
      };
    }),
  };
  const txPayment = { create: jest.fn(async ({ data }: any) => ({ id: 'pay_1', ...data })) };

  const tx = { invoice: txInvoice, payment: txPayment };
  const db: any = {
    subscriber,
    servicePlan,
    invoice,
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };

  const invoiceTax = {
    createInvoice: jest.fn(async (_tx: any, args: any) => ({ id: 'inv_1', ...args.data })),
    createLineItem: jest.fn(async (_tx: any, args: any) => ({ id: 'li_1', ...args })),
  };
  const routerAction = { reconnect: jest.fn(async () => ({ success: true, actionId: 'ra_1' })) };

  const service = new IspInvoicesService(
    { db } as unknown as PrismaService,
    routerAction as unknown as RouterActionService,
    invoiceTax as unknown as InvoiceTaxService,
  );

  return { service, subscriber, servicePlan, invoice, tx, txInvoice, txPayment, invoiceTax, routerAction, db };
}

describe('ISP IspInvoicesService', () => {
  describe('generateForSubscriber', () => {
    it('throws NotFound for a subscriber outside the org', async () => {
      const { service, db } = build({ subscriberFound: false });

      await expect(service.generateForSubscriber(ORG, { subscriberId: 'sub_1' } as any)).rejects.toThrow(
        NotFoundException,
      );
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('creates a draft invoice and a subscription line item at the plan price', async () => {
      const { service, invoiceTax } = build();

      await service.generateForSubscriber(ORG, { subscriberId: 'sub_1' } as any);

      expect(invoiceTax.createInvoice).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: ORG, subscriberId: 'sub_1' }),
        }),
      );
      const line = invoiceTax.createLineItem.mock.calls[0][1];
      expect(line.unitPrice.toString()).toBe('3000');
      expect(line.total.toString()).toBe('3000');
    });

    it('does not add a line item when the subscriber has no plan', async () => {
      const { service, invoiceTax, subscriber } = build();
      subscriber.findFirst.mockResolvedValue({ id: 'sub_1', organizationId: ORG, planId: null as any });

      await service.generateForSubscriber(ORG, { subscriberId: 'sub_1' } as any);

      expect(invoiceTax.createLineItem).not.toHaveBeenCalled();
    });
  });

  describe('reads', () => {
    it('lists invoices scoped to org + subscriber', async () => {
      const { service, invoice } = build();

      await service.findBySubscriber(ORG, 'sub_1');

      expect(invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: ORG, subscriberId: 'sub_1' } }),
      );
    });

    it('throws NotFound reading another org invoice', async () => {
      const { service, invoice } = build();

      await expect(service.findOne(OTHER_ORG, 'inv_1')).rejects.toThrow(NotFoundException);
      expect(invoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'inv_1', organizationId: OTHER_ORG } }),
      );
    });
  });

  describe('addLineItem', () => {
    it('rejects adding a line item to a PAID invoice', async () => {
      const { service, db } = build({ invoice: { id: 'inv_1', organizationId: ORG, status: InvoiceStatus.PAID } });

      await expect(
        service.addLineItem(ORG, 'inv_1', { description: 'Extra', quantity: 1, unitPrice: 100 } as any),
      ).rejects.toThrow(BadRequestException);
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('computes the line total as quantity × unit price', async () => {
      const { service, invoiceTax } = build();

      await service.addLineItem(ORG, 'inv_1', {
        description: 'Installation',
        quantity: 2,
        unitPrice: 750.5,
      } as any);

      const line = invoiceTax.createLineItem.mock.calls[0][1];
      expect(line.quantity.toString()).toBe('2');
      expect(line.total.toString()).toBe('1501');
    });
  });

  describe('recordPayment', () => {
    it('records the payment and increments amountPaid', async () => {
      const { service, txPayment, txInvoice } = build({ totalDue: 1000 });

      await service.recordPayment(ORG, 'inv_1', { amount: 200, method: 'MPESA' } as any);

      expect(txPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ invoiceId: 'inv_1', amount: expect.anything(), method: 'MPESA' }),
        }),
      );
      expect(txInvoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv_1' },
          data: { amountPaid: { increment: expect.anything() } },
        }),
      );
    });

    it('marks an invoice PAID and auto-reconnects a suspended subscriber', async () => {
      const { service, routerAction, db, txInvoice } = build({
        totalDue: 1000,
        invoice: {
          id: 'inv_1',
          organizationId: ORG,
          subscriberId: 'sub_1',
          status: InvoiceStatus.ISSUED,
          adjustmentsTotal: 0,
          consumptionTotal: 1000,
          roomTotal: 0,
          amountPaid: 0,
          suspendedForNonPayment: true,
        },
      });

      const result = await service.recordPayment(ORG, 'inv_1', { amount: 1000, method: 'MPESA' } as any);

      expect(result.status).toBe(InvoiceStatus.PAID);
      expect(routerAction.reconnect).toHaveBeenCalledWith(ORG, 'sub_1', 'billing');
      expect(db.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv_1' },
        data: { suspendedForNonPayment: false },
      });
      // The status upgrade must happen inside the same transaction.
      expect(txInvoice.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('lifecycle', () => {
    it('issues a DRAFT invoice', async () => {
      const { service, invoice } = build();

      await service.issue(ORG, 'inv_1');

      expect(invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv_1' },
          data: expect.objectContaining({ status: InvoiceStatus.ISSUED, issuedAt: expect.any(Date) }),
        }),
      );
    });

    it('refuses to issue a non-DRAFT invoice', async () => {
      const { service, invoice } = build({ invoice: { id: 'inv_1', organizationId: ORG, status: InvoiceStatus.PAID } });

      await expect(service.issue(ORG, 'inv_1')).rejects.toThrow(BadRequestException);
      expect(invoice.update).not.toHaveBeenCalled();
    });

    it('voids an invoice only after the org-scoped read gate', async () => {
      const { service, invoice } = build();

      await service.void(ORG, 'inv_1');

      expect(invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'inv_1' }, data: { status: InvoiceStatus.VOIDED } }),
      );
    });

    it('cannot void another org invoice', async () => {
      const { service, invoice } = build();

      await expect(service.void(OTHER_ORG, 'inv_1')).rejects.toThrow(NotFoundException);
      expect(invoice.update).not.toHaveBeenCalled();
    });
  });
});
