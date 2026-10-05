import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { StockBatchesService } from './stock-batches.service';
import { expectEveryCallScopedToOrg } from '../../test-utils/tenant-isolation';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';
const decimal = (value: number | string) => new Prisma.Decimal(value);

function build(opts: { batches?: any[] } = {}) {
  const batches = opts.batches ?? [
    { id: 'b_early', organizationId: ORG, inventoryItemId: 'item_1', batchNumber: 'B1', quantity: decimal(2), expiryDate: new Date('2026-01-01') },
    { id: 'b_late', organizationId: ORG, inventoryItemId: 'item_1', batchNumber: 'B2', quantity: decimal(8), expiryDate: new Date('2026-06-01') },
  ];
  const stockBatch = {
    create: jest.fn(async ({ data }: any) => ({ id: 'b_new', ...data })),
    findMany: jest.fn(async (args: any) =>
      batches.filter((b) => b.organizationId === args?.where?.organizationId),
    ),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
    findFirstOrThrow: jest.fn(async (args: any) => {
      const match = batches.find(
        (b) => b.id === args?.where?.id && b.organizationId === args?.where?.organizationId,
      );
      if (!match) throw new Error('No record found');
      return match;
    }),
  };
  const inventoryItem = {
    findFirstOrThrow: jest.fn(async (args: any) => {
      if (args?.where?.organizationId !== ORG) throw new Error('No record found');
      return { id: args.where.id, organizationId: ORG };
    }),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  };
  const tx = { stockBatch, inventoryItem };
  const $transaction = jest.fn(async (cb: any) => cb(tx));
  const db: any = { stockBatch, inventoryItem, $transaction };
  const service = new StockBatchesService({ db } as unknown as PrismaService);
  return { service, stockBatch, inventoryItem, $transaction };
}

describe('StockBatchesService', () => {
  it('creates a batch and increments the item quantity in one transaction', async () => {
    const { service, stockBatch, inventoryItem, $transaction } = build();

    await service.create(
      { inventoryItemId: 'item_1', batchNumber: 'B3', expiryDate: '2026-09-01', quantity: 12 },
      ORG,
    );

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(stockBatch.create.mock.calls[0][0].data.organizationId).toBe(ORG);
    expect(stockBatch.create.mock.calls[0][0].data.expiryDate).toEqual(new Date('2026-09-01'));
    expect(inventoryItem.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'item_1', organizationId: ORG },
    });
    expect(inventoryItem.update).toHaveBeenCalledWith({
      where: { id: 'item_1' },
      data: { quantity: { increment: 12 } },
    });
  });

  it('refuses to attach a batch to another org\u2019s item', async () => {
    const { service, inventoryItem } = build();

    await expect(
      service.create(
        { inventoryItemId: 'item_1', batchNumber: 'B4', expiryDate: '2026-09-01', quantity: 1 },
        OTHER_ORG,
      ),
    ).rejects.toThrow('No record found');
    expect(inventoryItem.update).not.toHaveBeenCalled();
  });

  it('lists batches for an item scoped to the org', async () => {
    const { service, stockBatch } = build();

    const rows = (await service.findByItem('item_1', ORG)) as unknown[];

    expect(rows).toHaveLength(2);
    expectEveryCallScopedToOrg(stockBatch.findMany, ORG);
  });

  it('finds only in-stock batches expiring within the window', async () => {
    const { service, stockBatch } = build();
    const before = Date.now();

    await service.findExpiring(ORG, 30);

    const args = stockBatch.findMany.mock.calls[0][0] as any;
    expect(args.where.organizationId).toBe(ORG);
    expect(args.where.quantity).toEqual({ gt: 0 });
    const cutoff = args.where.expiryDate.lte.getTime();
    expect(cutoff).toBeGreaterThan(before + 29 * 24 * 60 * 60 * 1000);
    expect(cutoff).toBeLessThan(before + 31 * 24 * 60 * 60 * 1000);
  });

  it('deducts FIFO by soonest expiry', async () => {
    const { service, stockBatch } = build();

    const applied = await service.deductFifo('item_1', ORG, 5);

    expect(applied).toEqual([
      { batchId: 'b_early', deducted: 2 },
      { batchId: 'b_late', deducted: 3 },
    ]);
    expect(Number(stockBatch.update.mock.calls[0][0].data.quantity.decrement)).toBe(2);
    expect(Number(stockBatch.update.mock.calls[1][0].data.quantity.decrement)).toBe(3);
  });

  it('refuses a FIFO deduction larger than total batch stock', async () => {
    const { service, stockBatch } = build();

    await expect(service.deductFifo('item_1', ORG, 100)).rejects.toThrow(
      'Insufficient stock in batches',
    );
    expect(stockBatch.update).not.toHaveBeenCalled();
  });

  it('zeroes a retired batch only for the owning org', async () => {
    const { service, stockBatch } = build();

    await service.retire('b_early', ORG);
    expect(stockBatch.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'b_early', organizationId: ORG },
    });
    expect(stockBatch.update).toHaveBeenCalledWith({
      where: { id: 'b_early' },
      data: { quantity: 0 },
    });

    await expect(service.retire('b_early', OTHER_ORG)).rejects.toThrow('No record found');
  });
});
