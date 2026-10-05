import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { InvoiceTaxService } from '../../tax/invoice-tax.service';
import { EquipmentService } from './equipment.service';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function build(opts: { quantity?: string; subscriberFound?: boolean; itemFound?: boolean; workOrderFound?: boolean } = {}) {
  const subscriber = {
    findFirst: jest.fn(async (args: any) =>
      (opts.subscriberFound ?? true) && args?.where?.organizationId === ORG
        ? { id: 'sub_1', organizationId: ORG, name: 'Jane' }
        : null,
    ),
  };
  const workOrder = {
    findFirst: jest.fn(async (args: any) =>
      (opts.workOrderFound ?? true) && args?.where?.organizationId === ORG
        ? { id: 'wo_1', organizationId: ORG, subscriberId: 'sub_1' }
        : null,
    ),
  };
  const inventoryItem = {
    findFirst: jest.fn(async (args: any) =>
      (opts.itemFound ?? true) && args?.where?.organizationId === ORG
        ? {
            id: 'item_1',
            organizationId: ORG,
            name: 'Router',
            quantity: new Prisma.Decimal(opts.quantity ?? '10'),
            sellingPrice: new Prisma.Decimal('5000'),
            costPrice: new Prisma.Decimal('4000'),
          }
        : null,
    ),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const tx = {
    inventoryItem: {
      update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
    inventoryTransaction: {
      create: jest.fn(async ({ data }: any) => ({ id: 'tx_1', ...data })),
    },
    invoice: { findFirst: jest.fn(async () => null) },
  };
  const db: any = {
    subscriber,
    workOrder,
    inventoryItem,
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const invoiceTax = {
    createInvoice: jest.fn(async (_tx: any, args: any) => ({ id: 'inv_1', ...args.data })),
    createLineItem: jest.fn(async (_tx: any, args: any) => ({ id: 'li_1', ...args })),
  };
  const service = new EquipmentService(
    { db } as unknown as PrismaService,
    invoiceTax as unknown as InvoiceTaxService,
  );
  return { service, subscriber, workOrder, inventoryItem, tx, invoiceTax, db };
}

describe('ISP EquipmentService', () => {
  it('rejects issuing to a subscriber outside the org', async () => {
    const { service, db } = build({ subscriberFound: false });

    await expect(
      service.issue(ORG, { subscriberId: 'sub_1', itemId: 'item_1', quantity: 1 } as any),
    ).rejects.toThrow(NotFoundException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects issuing more stock than is available', async () => {
    const { service, db } = build({ quantity: '2' });

    await expect(
      service.issue(ORG, { subscriberId: 'sub_1', itemId: 'item_1', quantity: 5 } as any),
    ).rejects.toThrow(BadRequestException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an item that belongs to another org', async () => {
    const { service, inventoryItem } = build({ itemFound: false });

    await expect(
      service.issue(ORG, { subscriberId: 'sub_1', itemId: 'foreign', quantity: 1 } as any),
    ).rejects.toThrow(NotFoundException);
    expect(inventoryItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'foreign', organizationId: ORG } }),
    );
  });

  it('rejects a work order that does not belong to the subscriber/org', async () => {
    const { service, db } = build({ workOrderFound: false });

    await expect(
      service.issue(ORG, {
        subscriberId: 'sub_1',
        itemId: 'item_1',
        quantity: 1,
        workOrderId: 'wo_evil',
      } as any),
    ).rejects.toThrow(NotFoundException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('deducts stock and writes an org-scoped ledger row atomically', async () => {
    const { service, tx } = build({ quantity: '10' });

    await service.issue(ORG, { subscriberId: 'sub_1', itemId: 'item_1', quantity: 3 } as any);

    expect(tx.inventoryItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'item_1' } }),
    );
    const ledger = tx.inventoryTransaction.create.mock.calls[0][0].data;
    expect(ledger.organizationId).toBe(ORG);
    expect(ledger.subscriberId).toBe('sub_1');
    expect(ledger.quantityBefore.toString()).toBe('10');
    expect(ledger.quantityChange.toString()).toBe('-3');
    expect(ledger.quantityAfter.toString()).toBe('7');
  });

  it('charges the issued equipment to a fresh draft invoice when requested', async () => {
    const { service, invoiceTax } = build();

    await service.issue(ORG, {
      subscriberId: 'sub_1',
      itemId: 'item_1',
      quantity: 2,
      chargeToInvoice: true,
    } as any);

    expect(invoiceTax.createInvoice).toHaveBeenCalled();
    const line = invoiceTax.createLineItem.mock.calls[0][1];
    expect(line.invoiceId).toBe('inv_1');
    expect(line.quantity.toString()).toBe('2');
    expect(line.total.toString()).toBe('10000');
  });

  it('lists issued equipment scoped to org + subscriber', async () => {
    const { service, db } = build();
    (db as any).inventoryTransaction = { findMany: jest.fn(async () => []) };

    await service.findBySubscriber(ORG, 'sub_1');

    expect((db as any).inventoryTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG, subscriberId: 'sub_1' } }),
    );
  });

  it('lists issued equipment scoped to org + work order', async () => {
    const { service, db } = build();
    (db as any).inventoryTransaction = { findMany: jest.fn(async () => []) };

    await service.findByWorkOrder(ORG, 'wo_1');

    expect((db as any).inventoryTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG, workOrderId: 'wo_1' } }),
    );
  });
});
