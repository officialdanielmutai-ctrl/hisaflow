import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { AlertsService } from '../alerts/alerts.service';
import { CreditService } from '../finance/credit.service';
import { CreateTransactionDto, TransactionTypeDto } from './dto/create-transaction.dto';
import { TransactionsService } from './transactions.service';
import {
  expectEveryCallScopedToOrg,
  expectNoCrossOrgRows,
} from '../../test-utils/tenant-isolation';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';

const decimal = (value: number | string) => new Prisma.Decimal(value);

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item_1',
    organizationId: ORG,
    name: 'Sugar',
    unit: 'kg',
    quantity: decimal(10),
    sellingPrice: decimal('120.00'),
    costPrice: decimal('90.00'),
    isComposite: false,
    tieredPriceRules: [],
    recipeLines: [],
    organization: { businessType: 'RETAIL' },
    ...overrides,
  };
}

function build(opts: { product?: Record<string, unknown> | null; batches?: unknown[] } = {}) {
  const inventoryItemFindFirst = jest.fn(async (args: { where?: { organizationId?: string } }) => {
    if (args?.where?.organizationId !== ORG) return null;
    if (opts.product === null) return null;
    return opts.product ?? product();
  });
  const inventoryItemUpdate = jest.fn(async ({ where, data }: any) => ({
    id: where.id,
    ...data,
  }));
  const inventoryTransactionCreate = jest.fn(async ({ data }: any) => ({
    id: 'tx_1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...data,
  }));
  const stockBatchFindMany = jest.fn(async () => opts.batches ?? []);
  const stockBatchUpdate = jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data }));
  const alertCreate = jest.fn(async ({ data }: any) => ({ id: 'alert_1', ...data }));
  const $transaction = jest.fn(async (arg: any) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    return arg({});
  });

  const db: any = {
    inventoryItem: { findFirst: inventoryItemFindFirst, update: inventoryItemUpdate },
    inventoryTransaction: { create: inventoryTransactionCreate, findMany: jest.fn() },
    stockBatch: { findMany: stockBatchFindMany, update: stockBatchUpdate },
    alert: { create: alertCreate },
    $transaction,
  };

  const prisma = { db } as unknown as PrismaService;
  const alertsService = {
    runAllChecks: jest.fn(async () => undefined),
  } as unknown as AlertsService;
  const creditServiceMock = {
    createForTransaction: jest.fn(async (..._args: unknown[]) => ({ id: 'cr_1' })),
  };
  const creditService = creditServiceMock as unknown as CreditService;

  const service = new TransactionsService(prisma, alertsService, creditService);

  return {
    service,
    inventoryItemFindFirst,
    inventoryItemUpdate,
    inventoryTransactionCreate,
    stockBatchFindMany,
    stockBatchUpdate,
    alertCreate,
    $transaction,
    alertsService,
    creditService: creditServiceMock,
  };
}

function dto(overrides: Partial<CreateTransactionDto> = {}): CreateTransactionDto {
  return {
    itemId: 'item_1',
    type: TransactionTypeDto.SALE,
    quantity: 3,
    ...overrides,
  } as CreateTransactionDto;
}

describe('TransactionsService — stock math and ledger', () => {
  it('deducts a SALE and writes the ledger row in one transaction', async () => {
    const { service, inventoryItemUpdate, $transaction } = build();

    const result = await service.create(dto({ type: TransactionTypeDto.SALE, quantity: 3 }), ORG);

    expect(result).toEqual({ success: true, newQuantity: 7 });
    expect(inventoryItemUpdate).toHaveBeenCalledTimes(1);
    expect(Number(inventoryItemUpdate.mock.calls[0][0].data.quantity)).toBe(7);
    expect($transaction).toHaveBeenCalledTimes(1);
  });

  it('adds a PURCHASE to existing stock', async () => {
    const { service, inventoryItemUpdate } = build();

    const result = await service.create(
      dto({ type: TransactionTypeDto.PURCHASE, quantity: 4 }),
      ORG,
    );

    expect(result.newQuantity).toBe(14);
    expect(Number(inventoryItemUpdate.mock.calls[0][0].data.quantity)).toBe(14);
  });

  it('rejects a SALE that would drive stock negative', async () => {
    const { service, inventoryItemUpdate } = build();

    await expect(
      service.create(dto({ type: TransactionTypeDto.SALE, quantity: 11 }), ORG),
    ).rejects.toThrow(BadRequestException);

    expect(inventoryItemUpdate).not.toHaveBeenCalled();
  });

  it('scopes the item lookup to the calling organisation and rejects a foreign item', async () => {
    const { service, inventoryItemFindFirst } = build();

    await expect(
      service.create(dto({ type: TransactionTypeDto.SALE, quantity: 1 }), OTHER_ORG),
    ).rejects.toThrow('Product not found');

    expectEveryCallScopedToOrg(inventoryItemFindFirst, OTHER_ORG);
  });

  it('applies the matching tiered price to a SALE and records it in metadata', async () => {
    const { service, inventoryTransactionCreate } = build({
      product: product({
        tieredPriceRules: [
          { minQuantity: decimal(5), pricePerUnit: decimal('100') },
          { minQuantity: decimal(1), pricePerUnit: decimal('120') },
        ],
      }),
    });

    await service.create(dto({ type: TransactionTypeDto.SALE, quantity: 5 }), ORG);

    const ledger = inventoryTransactionCreate.mock.calls[0][0].data;
    expect(ledger.metadata.appliedTierPrice).toBe(100);
    expect(Number(ledger.quantityChange)).toBe(-5);
  });

  it('creates a credit record for a credit SALE using the applied price', async () => {
    const { service, creditService } = build();

    await service.create(
      dto({
        type: TransactionTypeDto.SALE,
        quantity: 2,
        isCredit: true,
        clientName: 'Jane Wanjiru',
      }),
      ORG,
    );

    expect(creditService.createForTransaction).toHaveBeenCalledTimes(1);
    const [, txId, client, amount] = creditService.createForTransaction.mock.calls[0];
    expect(txId).toBe('tx_1');
    expect(client).toBe('Jane Wanjiru');
    expect(amount).toBe(240);
  });

  it('creates an INFO staff-activity alert when a STAFF actor logs a transaction', async () => {
    const { service, alertCreate } = build();

    await service.create(dto({ type: TransactionTypeDto.PURCHASE, quantity: 2 }), ORG, {
      actorId: 'user_1',
      actorName: 'Brian',
      actorRole: 'STAFF',
    });

    expect(alertCreate).toHaveBeenCalledTimes(1);
    expect(alertCreate.mock.calls[0][0].data).toMatchObject({
      organizationId: ORG,
      type: 'STAFF_ACTIVITY',
      severity: 'INFO',
    });
  });

  it('runs stock alert checks after a successful transaction', async () => {
    const { service, alertsService } = build();

    await service.create(dto(), ORG);

    expect(alertsService.runAllChecks).toHaveBeenCalledWith(ORG);
  });

  it('deducts from the soonest-expiring chemist batches first', async () => {
    const { service, stockBatchUpdate, inventoryItemUpdate } = build({
      product: product({ organization: { businessType: 'CHEMIST' } }),
      batches: [
        { id: 'batch_early', quantity: decimal(2), batchNumber: 'B1', expiryDate: new Date('2026-01-01') },
        { id: 'batch_late', quantity: decimal(8), batchNumber: 'B2', expiryDate: new Date('2026-06-01') },
      ],
    });

    await service.create(dto({ type: TransactionTypeDto.SALE, quantity: 5 }), ORG);

    expect(stockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(Number(stockBatchUpdate.mock.calls[0][0].data.quantity)).toBe(0);
    expect(Number(stockBatchUpdate.mock.calls[1][0].data.quantity)).toBe(5);
    expect(Number(inventoryItemUpdate.mock.calls[0][0].data.quantity)).toBe(5);
  });

  it('rejects a chemist deduction that exceeds total batch stock', async () => {
    const { service } = build({
      product: product({ organization: { businessType: 'CHEMIST' } }),
      batches: [
        { id: 'batch_1', quantity: decimal(2), batchNumber: 'B1', expiryDate: new Date('2026-01-01') },
      ],
    });

    await expect(
      service.create(dto({ type: TransactionTypeDto.SALE, quantity: 5 }), ORG),
    ).rejects.toThrow('Insufficient stock across all batches');
  });
});

describe('TransactionsService — findAll tenant scope', () => {
  it('queries only the calling org and maps rows to the API shape', async () => {
    const { service } = build();
    const findMany = jest.fn(async (_args: { where?: Record<string, unknown> } = {}) => [
      {
        id: 'tx_1',
        type: 'SALE',
        quantityChange: decimal(-2),
        reason: 'sold',
        createdAt: new Date('2026-01-02T03:04:05.000Z'),
        item: { id: 'item_1', name: 'Sugar', unit: 'kg' },
      },
    ]);
    (service as any).prisma.db.inventoryTransaction.findMany = findMany;

    const rows = await service.findAll(ORG, { itemId: 'item_1' });

    const whereArg = findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(whereArg.where).toMatchObject({
      organizationId: ORG,
      itemId: 'item_1',
    });
    expect(rows).toEqual([
      {
        id: 'tx_1',
        type: 'SALE',
        quantity: -2,
        note: 'sold',
        createdAt: '2026-01-02T03:04:05.000Z',
        inventoryItem: { id: 'item_1', name: 'Sugar', unit: 'kg' },
      },
    ]);
    expectNoCrossOrgRows(rows, ORG);
  });
});
