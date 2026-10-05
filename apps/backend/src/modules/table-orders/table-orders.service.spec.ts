import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { TableOrdersService } from './table-orders.service';
import { expectEveryCallScopedToOrg } from '../../test-utils/tenant-isolation';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';
const decimal = (value: number | string) => new Prisma.Decimal(value);

function build(opts: { order?: any } = {}) {
  const tableOrder = {
    create: jest.fn(async ({ data }: any) => ({ id: 'order_new', ...data })),
    findMany: jest.fn(async (_args?: any) => [{ id: 'order_1', organizationId: ORG }]),
    findFirstOrThrow: jest.fn(async (args: any) => {
      if (args?.where?.organizationId !== ORG) throw new Error('No record found');
      return opts.order ?? { id: args.where.id, organizationId: ORG, status: 'OPEN' };
    }),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const tableOrderItem = {
    create: jest.fn(async ({ data }: any) => ({ id: 'oi_new', ...data })),
    findUniqueOrThrow: jest.fn(async ({ where }: any) => ({
      id: where.id,
      order: { organizationId: ORG, status: 'OPEN' },
    })),
    delete: jest.fn(async ({ where }: any) => ({ id: where.id })),
  };
  const inventoryItem = {
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const tx = { tableOrder, inventoryItem };
  const $transaction = jest.fn(async (cb: any) => cb(tx));
  const db: any = { tableOrder, tableOrderItem, inventoryItem, $transaction };
  const service = new TableOrdersService({ db } as unknown as PrismaService);
  return { service, tableOrder, tableOrderItem, inventoryItem, $transaction };
}

describe('TableOrdersService', () => {
  it('creates an OPEN order stamped with the org and its items', async () => {
    const { service, tableOrder } = build();

    await service.create(
      { tableLabel: 'T1', items: [{ itemId: 'i1', quantity: 2, unitPrice: 100 }] },
      ORG,
    );

    const data = tableOrder.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ organizationId: ORG, tableLabel: 'T1', status: 'OPEN' });
    expect(data.items.create[0]).toMatchObject({ itemId: 'i1', quantity: 2, unitPrice: 100 });
  });

  it('lists orders for the org filtered by status', async () => {
    const { service, tableOrder } = build();

    await service.findAll(ORG, 'PAID');

    expect(tableOrder.findMany.mock.calls[0][0].where).toEqual({
      organizationId: ORG,
      status: 'PAID',
    });
    expectEveryCallScopedToOrg(tableOrder.findMany, ORG);
  });

  it('throws for a foreign order', async () => {
    const { service } = build();

    await expect(service.findOne('order_1', OTHER_ORG)).rejects.toThrow('No record found');
  });

  it('adds an item only to an OPEN order', async () => {
    const { service, tableOrder, tableOrderItem } = build({
      order: { id: 'order_1', organizationId: ORG, status: 'PAID' },
    });

    await expect(
      service.addItem('order_1', { itemId: 'i1', quantity: 1, unitPrice: 50 }, ORG),
    ).rejects.toThrow(BadRequestException);
    expect(tableOrderItem.create).not.toHaveBeenCalled();
  });

  it('adds an item to an open order', async () => {
    const { service, tableOrderItem } = build();

    await service.addItem('order_1', { itemId: 'i1', quantity: 3, unitPrice: 50 }, ORG);

    expect(tableOrderItem.create.mock.calls[0][0].data).toMatchObject({
      orderId: 'order_1',
      itemId: 'i1',
      quantity: 3,
    });
  });

  it('refuses to remove an item from another org\u2019s order', async () => {
    const { service, tableOrderItem } = build();
    tableOrderItem.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'oi1',
      order: { organizationId: OTHER_ORG, status: 'OPEN' },
    });

    await expect(service.removeItem('oi1', ORG)).rejects.toThrow('Cannot remove item or unauthorized');
    expect(tableOrderItem.delete).not.toHaveBeenCalled();
  });

  it('refuses to remove an item from a closed order', async () => {
    const { service, tableOrderItem } = build();
    tableOrderItem.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'oi1',
      order: { organizationId: ORG, status: 'PAID' },
    });

    await expect(service.removeItem('oi1', ORG)).rejects.toThrow(BadRequestException);
  });

  it('closes an order by deducting simple inventory and marking PAID', async () => {
    const { service, tableOrder, inventoryItem, $transaction } = build({
      order: {
        id: 'order_1',
        organizationId: ORG,
        status: 'OPEN',
        items: [
          {
            quantity: decimal(2),
            item: { id: 'i1', isComposite: false, recipeLines: [] },
          },
        ],
      },
    });

    await service.closeOrder('order_1', ORG);

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(inventoryItem.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { quantity: { decrement: expect.any(Prisma.Decimal) } },
    });
    expect(tableOrder.update.mock.calls[0][0].data).toMatchObject({ status: 'PAID' });
  });

  it('closes a composite order by deducting each recipe ingredient', async () => {
    const { service, inventoryItem } = build({
      order: {
        id: 'order_1',
        organizationId: ORG,
        status: 'OPEN',
        items: [
          {
            quantity: decimal(2),
            item: {
              id: 'meal',
              isComposite: true,
              recipeLines: [{ ingredientId: 'ing_1', quantityUsed: decimal('0.5') }],
            },
          },
        ],
      },
    });

    await service.closeOrder('order_1', ORG);

    expect(inventoryItem.update).toHaveBeenCalledTimes(1);
    expect(inventoryItem.update.mock.calls[0][0].where).toEqual({ id: 'ing_1' });
  });

  it('refuses to close an order that is not OPEN', async () => {
    const { service } = build({
      order: { id: 'order_1', organizationId: ORG, status: 'PAID', items: [] },
    });

    await expect(service.closeOrder('order_1', ORG)).rejects.toThrow('Order is not OPEN');
  });

  it('voids only an OPEN order', async () => {
    const { service, tableOrder } = build();

    await service.voidOrder('order_1', ORG);
    expect(tableOrder.update.mock.calls[0][0].data.status).toBe('VOIDED');

    const paid = build({ order: { id: 'order_1', organizationId: ORG, status: 'PAID' } });
    await expect(paid.service.voidOrder('order_1', ORG)).rejects.toThrow('Can only void OPEN orders');
  });
});
