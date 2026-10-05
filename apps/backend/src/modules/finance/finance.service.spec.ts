import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma.service';
import { FinanceService } from './finance.service';
import { BusinessTransactionsService } from './business-transactions.service';
import { FinanceAiService } from './finance-ai.service';

const ORG = 'org_a';
const OTHER_ORG = 'org_b';
const decimal = (value: number | string) => new Prisma.Decimal(value);

function build(opts: { transactions?: any[]; manual?: any[] } = {}) {
  const inventoryItemFindMany = jest.fn(async () => [
    { id: 'i1', costPrice: decimal(5), sellingPrice: decimal(10), quantity: decimal(10) },
    { id: 'i2', costPrice: null, sellingPrice: decimal(8), quantity: decimal(3) },
    { id: 'i3', costPrice: decimal(4), sellingPrice: null, quantity: decimal(2) },
  ]);
  const inventoryTransactionFindMany = jest.fn(
    async () =>
      opts.transactions ?? [
        {
          createdAt: new Date('2026-01-01T08:00:00.000Z'),
          quantityChange: decimal(-2),
          item: { costPrice: decimal(5), sellingPrice: decimal(10) },
        },
        {
          createdAt: new Date('2026-01-01T12:00:00.000Z'),
          quantityChange: decimal(-1),
          item: { costPrice: decimal(5), sellingPrice: decimal(10) },
        },
        {
          createdAt: new Date('2026-01-02T09:00:00.000Z'),
          quantityChange: decimal(-4),
          item: { costPrice: decimal(5), sellingPrice: decimal(10) },
        },
      ],
  );
  const businessTransactionFindMany = jest.fn(async () => opts.manual ?? []);
  const inventoryItemFindFirst = jest.fn(async (args: any) => {
    if (args?.where?.organizationId !== ORG) return null;
    return {
      id: 'i1',
      name: 'Sugar',
      unit: 'kg',
      costPrice: decimal(5),
      sellingPrice: decimal(10),
      quantity: decimal(10),
    };
  });

  const db: any = {
    inventoryItem: { findMany: inventoryItemFindMany, findFirst: inventoryItemFindFirst },
    inventoryTransaction: { findMany: inventoryTransactionFindMany },
    businessTransaction: { findMany: businessTransactionFindMany },
  };
  const businessTxService = {
    createBusinessTransaction: jest.fn(),
    getBusinessTransactions: jest.fn(),
    deleteBusinessTransaction: jest.fn(),
    updateBusinessTransaction: jest.fn(),
    mapBusinessTx: jest.fn(),
  } as unknown as BusinessTransactionsService;
  const financeAiService = {
    getForecast: jest.fn(async () => ({ insights: [] })),
    getPriceSuggestions: jest.fn(async () => [{ itemId: 'i1' }]),
  } as unknown as FinanceAiService;
  const config = { get: jest.fn() };

  const service = new FinanceService(
    { db } as unknown as PrismaService,
    config as any,
    businessTxService,
    financeAiService,
  );
  return {
    service,
    inventoryItemFindMany,
    inventoryTransactionFindMany,
    businessTransactionFindMany,
    inventoryItemFindFirst,
    businessTxService,
    financeAiService,
  };
}

describe('FinanceService — legacy overview', () => {
  it('values inventory at cost, potential revenue at sell, and counts unpriced items', async () => {
    const { service } = build();

    const overview = await service.getOverview(ORG);

    expect(overview.totalInventoryValue).toBe(58);
    expect(overview.totalPotentialRevenue).toBe(124);
    expect(overview.unpricedCount).toBe(2);
    expect(overview.grossRevenue).toBe(70);
    expect(overview.grossCogs).toBe(35);
    expect(overview.grossProfit).toBe(35);
    expect(overview.grossMarginPct).toBe(50);
  });
});

describe('FinanceService — unified business overview', () => {
  it('subtracts operating expenses and adds other income into net profit', async () => {
    const { service } = build({
      manual: [
        { type: 'EXPENSE', category: 'RENT', amount: decimal(1000) },
        { type: 'EXPENSE', category: 'RENT', amount: decimal(500) },
        { type: 'INCOME', category: 'OTHER', amount: decimal(200) },
      ],
    });

    const overview = await service.getBusinessOverview(ORG, 'rolling30');

    expect(overview.totalOperatingExpenses).toBe(1500);
    expect(overview.totalOtherIncome).toBe(200);
    expect(overview.grossProfit).toBe(35);
    expect(overview.netProfit).toBe(-1265);
    expect(overview.netMarginPct).toBe(-468.5);
    expect(overview.expensesByCategory).toEqual([
      { category: 'RENT', total: 1500, count: 2 },
    ]);
    expect(overview.periodDays).toBe(30);
    expect(overview.dateMode).toBe('rolling30');
    expect(overview.periodLabel).toBe('Last 30 Days');
  });

  it('uses calendar bounds when calendar mode is requested', async () => {
    const { service } = build();

    const overview = await service.getBusinessOverview(ORG, 'calendar');
    const now = new Date();

    expect(overview.dateMode).toBe('calendar');
    expect(overview.periodStart).toBe(
      new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    );
  });

  it('guards against a divide-by-zero margin when there is no income', async () => {
    const { service } = build({ transactions: [], manual: [] });

    const overview = await service.getBusinessOverview(ORG, 'rolling30');

    expect(overview.grossRevenue).toBe(0);
    expect(overview.grossMarginPct).toBeNull();
    expect(overview.netMarginPct).toBeNull();
  });
});

describe('FinanceService — item profile', () => {
  it('computes profit and margin from the item trend', async () => {
    const { service } = build();

    const profile = await service.getItemProfile('i1', ORG);

    expect(profile.currentStock).toBe(10);
    expect(profile.stockValue).toBe(50);
    expect(profile.totalRevenue).toBe(70);
    expect(profile.totalCogs).toBe(35);
    expect(profile.totalProfit).toBe(35);
    expect(profile.grossMarginPct).toBe(50);
  });

  it('refuses to read an item from another org', async () => {
    const { service } = build();

    await expect(service.getItemProfile('i1', OTHER_ORG)).rejects.toThrow('Item not found');
  });

  it('delegates forecast and price suggestions to the AI service', async () => {
    const { service, financeAiService } = build();

    await service.getForecast(ORG);
    expect(financeAiService.getForecast).toHaveBeenCalledTimes(1);
    expect((financeAiService.getForecast as jest.Mock).mock.calls[0][0]).toBe(ORG);

    await service.getPriceSuggestions(ORG);
    expect(financeAiService.getPriceSuggestions).toHaveBeenCalledWith(ORG);
  });

  it('delegates business ledger CRUD to the ledger service', async () => {
    const { service, businessTxService } = build();

    await service.createBusinessTransaction(ORG, {
      type: 'EXPENSE',
      category: 'RENT',
      amount: 100,
    });
    expect(businessTxService.createBusinessTransaction).toHaveBeenCalledWith(ORG, {
      type: 'EXPENSE',
      category: 'RENT',
      amount: 100,
    });

    await service.deleteBusinessTransaction('bt_1', ORG);
    expect(businessTxService.deleteBusinessTransaction).toHaveBeenCalledWith('bt_1', ORG);
  });
});
