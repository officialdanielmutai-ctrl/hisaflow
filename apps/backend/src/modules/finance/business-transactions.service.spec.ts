import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { BusinessTransactionsService } from './business-transactions.service';
import { expectEveryCallScopedToOrg } from '../../test-utils/tenant-isolation';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bt_1',
    organizationId: ORG,
    type: 'EXPENSE',
    category: 'RENT',
    amount: new Prisma.Decimal('15000.50'),
    description: 'January rent',
    staffName: null,
    date: new Date('2026-01-05T00:00:00.000Z'),
    isRecurring: false,
    recurrenceRule: null,
    createdAt: new Date('2026-01-05T10:00:00.000Z'),
    ...overrides,
  };
}

function build() {
  const create = jest.fn(async ({ data }: any) => record({ ...data, id: 'bt_new' }));
  const findMany = jest.fn(async (_args: { where?: Record<string, unknown> } = {}) => [record()]);
  const deleteMany = jest.fn(async () => ({ count: 1 }));
  const findFirst = jest.fn(async (args: any) => {
    if (args?.where?.organizationId !== ORG) return null;
    return record();
  });
  const update = jest.fn(async ({ where, data }: any) => record({ ...data, id: where.id }));

  const db: any = {
    businessTransaction: { create, findMany, deleteMany, findFirst, update },
  };
  const service = new BusinessTransactionsService({ db } as unknown as PrismaService);
  return { service, create, findMany, deleteMany, findFirst, update };
}

describe('BusinessTransactionsService', () => {
  it('maps Decimal amounts and Dates into a JSON-safe record', () => {
    const { service } = build();

    const mapped = service.mapBusinessTx(record());

    expect(mapped).toEqual({
      id: 'bt_1',
      type: 'EXPENSE',
      category: 'RENT',
      amount: 15000.5,
      description: 'January rent',
      staffName: null,
      date: '2026-01-05',
      isRecurring: false,
      recurrenceRule: null,
      createdAt: '2026-01-05T10:00:00.000Z',
    });
  });

  it('creates an expense scoped to the organisation and defaults the date', async () => {
    const { service, create } = build();
    const before = Date.now();

    const created = await service.createBusinessTransaction(ORG, {
      type: 'EXPENSE',
      category: 'RENT',
      amount: 15000.5,
    });

    expect(create.mock.calls[0][0].data.organizationId).toBe(ORG);
    expect(create.mock.calls[0][0].data.amount).toBe(15000.5);
    expect(created.amount).toBe(15000.5);
    expect(new Date(create.mock.calls[0][0].data.date as Date).getTime()).toBeGreaterThanOrEqual(
      before - 1000,
    );
  });

  it('applies type/category/date filters without dropping the tenant scope', async () => {
    const { service, findMany } = build();

    await service.getBusinessTransactions(ORG, {
      type: 'EXPENSE',
      category: 'RENT',
      from: '2026-01-01',
      to: '2026-01-31',
    });

    const args = findMany.mock.calls[0][0] as any;
    expect(args.where).toMatchObject({ organizationId: ORG, type: 'EXPENSE', category: 'RENT' });
    expect(args.where.date.gte).toEqual(new Date('2026-01-01'));
    expect(args.where.date.lte).toEqual(new Date('2026-01-31'));
    expect(args.orderBy).toEqual({ date: 'desc' });
    expect(args.take).toBe(200);
    expectEveryCallScopedToOrg(findMany, ORG);
  });

  it('deletes with both id and organisationId so a foreign id is a no-op', async () => {
    const { service, deleteMany } = build();

    await service.deleteBusinessTransaction('bt_1', ORG);

    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'bt_1', organizationId: ORG } });
  });

  it('refuses to update a transaction owned by another org', async () => {
    const { service, update } = build();

    await expect(
      service.updateBusinessTransaction('bt_1', OTHER_ORG, { amount: 1 }),
    ).rejects.toThrow('Transaction not found');
    expect(update).not.toHaveBeenCalled();
  });

  it('only writes the fields supplied in the update DTO', async () => {
    const { service, update } = build();

    await service.updateBusinessTransaction('bt_1', ORG, { amount: 999, isRecurring: true });

    const data = update.mock.calls[0][0].data;
    expect(data).toEqual({ amount: 999, isRecurring: true });
  });
});
