import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { CreditService } from './credit.service';
import { expectEveryCallScopedToOrg } from '../../test-utils/tenant-isolation';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';
const decimal = (value: number | string) => new Prisma.Decimal(value);

function credit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'credit_1',
    organizationId: ORG,
    clientName: 'Jane Wanjiru',
    amountTotal: decimal('1000'),
    amountPaid: decimal('0'),
    status: 'UNPAID',
    transactionId: 'tx_1',
    dueDate: null,
    notes: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    transaction: null,
    ...overrides,
  };
}

function build(opts: { credits?: any[]; linkedItemPrice?: string | null } = {}) {
  const credits = opts.credits ?? [credit()];
  const findMany = jest.fn(async (args: any) => {
    const scoped = credits.filter((c) => c.organizationId === args?.where?.organizationId);
    return scoped.map((c) => ({
      ...c,
      transaction:
        opts.linkedItemPrice != null
          ? {
              quantityChange: decimal(-2),
              item: { id: 'item_1', name: 'Sugar', unit: 'kg', sellingPrice: decimal(opts.linkedItemPrice) },
            }
          : c.transaction,
    }));
  });
  const findFirst = jest.fn(async (args: any) =>
    credits.find(
      (c) => c.id === args?.where?.id && c.organizationId === args?.where?.organizationId,
    ) ?? null,
  );
  const creditUpdate = jest.fn(async ({ where, data }: any) => ({ ...credit(), id: where.id, ...data }));
  const businessCreate = jest.fn(async ({ data }: any) => ({ id: 'bt_1', ...data }));
  const creditCreate = jest.fn(async ({ data }: any) => ({ id: 'credit_new', ...data }));

  const $transaction = jest.fn(async (ops: any) =>
    Array.isArray(ops) ? Promise.all(ops) : ops,
  );

  const db: any = {
    creditRecord: {
      findMany,
      findFirst,
      update: creditUpdate,
      create: creditCreate,
    },
    businessTransaction: { create: businessCreate },
    $transaction,
  };
  const service = new CreditService({ db } as unknown as PrismaService);
  return { service, findMany, findFirst, creditUpdate, businessCreate, creditCreate, $transaction };
}

describe('CreditService', () => {
  it('lists only the calling org\u2019s credits', async () => {
    const foreign = credit({ id: 'credit_foreign', organizationId: OTHER_ORG });
    const { service, findMany } = build({ credits: [credit(), foreign] });

    const rows = (await service.findAll(ORG)) as Array<{ id: string }>;

    expect(rows.map((r) => r.id)).toEqual(['credit_1']);
    expectEveryCallScopedToOrg(findMany, ORG);
  });

  it('repairs a stale KES 0 credit from the linked item price', async () => {
    const stale = credit({ amountTotal: decimal('0') });
    const { service, creditUpdate } = build({
      credits: [stale],
      linkedItemPrice: '250',
    });

    await service.findAll(ORG);

    expect(creditUpdate).toHaveBeenCalledTimes(1);
    expect(Number(creditUpdate.mock.calls[0][0].data.amountTotal)).toBe(500);
  });

  it('throws NotFound for a credit in another org', async () => {
    const foreign = credit({ id: 'credit_foreign', organizationId: OTHER_ORG });
    const { service } = build({ credits: [foreign] });

    await expect(service.findOne('credit_foreign', ORG)).rejects.toThrow(NotFoundException);
  });

  it('records a partial payment, marks PARTIAL, and logs ledger income atomically', async () => {
    const { service, creditUpdate, businessCreate, $transaction } = build();

    const updated = (await service.recordPayment('credit_1', ORG, { amount: 400 })) as any;

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(Number(updated.amountPaid)).toBe(400);
    expect(updated.status).toBe('PARTIAL');
    expect(creditUpdate.mock.calls[0][0].data).toMatchObject({ amountPaid: 400, status: 'PARTIAL' });
    expect(businessCreate).toHaveBeenCalledTimes(1);
    const ledger = businessCreate.mock.calls[0][0].data;
    expect(ledger).toMatchObject({
      organizationId: ORG,
      type: 'INCOME',
      category: 'CREDIT_PAYMENT',
      amount: 400,
    });
  });

  it('marks the credit PAID when the payment settles the balance', async () => {
    const { service } = build({ credits: [credit({ amountPaid: decimal('600') })] });

    const updated = (await service.recordPayment('credit_1', ORG, { amount: 400 })) as any;

    expect(updated.status).toBe('PAID');
  });

  it('uses a valid due date and nulls an invalid one on full edit', async () => {
    const { service, creditUpdate } = build();

    await service.updateCredit('credit_1', ORG, { dueDate: 'not-a-date' });
    expect(creditUpdate.mock.calls[0][0].data.dueDate).toBeNull();

    await service.updateCredit('credit_1', ORG, { dueDate: '2026-03-01' });
    expect(creditUpdate.mock.calls[1][0].data.dueDate).toEqual(new Date('2026-03-01'));
  });

  it('creates a manual credit scoped to the org', async () => {
    const { service, creditCreate } = build();

    await service.createManualCredit(ORG, {
      clientName: 'Peter',
      amountTotal: 750,
      dueDate: '2026-02-01',
      notes: 'stock taken on account',
    });

    expect(creditCreate.mock.calls[0][0].data).toMatchObject({
      organizationId: ORG,
      clientName: 'Peter',
      amountTotal: 750,
      notes: 'stock taken on account',
    });
    expect(creditCreate.mock.calls[0][0].data.dueDate).toEqual(new Date('2026-02-01'));
  });

  it('creates a transaction-linked credit for a credit sale', async () => {
    const { service, creditCreate } = build();

    await service.createForTransaction(ORG, 'tx_9', 'Mary', 1200, undefined, '2 bags');

    expect(creditCreate.mock.calls[0][0].data).toMatchObject({
      organizationId: ORG,
      transactionId: 'tx_9',
      clientName: 'Mary',
      amountTotal: 1200,
      notes: '2 bags',
    });
    expect(creditCreate.mock.calls[0][0].data.dueDate).toBeUndefined();
  });
});
