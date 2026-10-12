import { BadRequestException } from '@nestjs/common';
import { WholesaleAssistantToolsService } from './wholesale-assistant-tools.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import type { ToolContext, ToolDefinition } from '../tool.types';

const CTX = {
  organizationId: 'org_1',
  userId: 'user_1',
  role: AppRole.OWNER,
  businessType: 'WHOLESALER',
  tier: 'SOLO',
  isImpersonated: false,
} satisfies ToolContext;

const ITEM = {
  id: 'item_1',
  name: 'Sugar',
  unit: 'kg',
  quantity: 500,
  sellingPrice: 120,
};

type MockFn = jest.Mock;

interface Harness {
  service: WholesaleAssistantToolsService;
  db: {
    inventoryItem: { findFirst: MockFn; findMany: MockFn };
    creditRecord: { findFirst: MockFn; findMany: MockFn };
    inventoryTransaction: { groupBy: MockFn };
  };
  transactions: { create: MockFn };
  credits: { recordPayment: MockFn };
  tieredPricing: { upsertRules: MockFn };
  byName: (name: string) => ToolDefinition;
}

function build(): Harness {
  const db = {
    inventoryItem: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    creditRecord: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    inventoryTransaction: { groupBy: jest.fn(async () => [] as unknown[]) },
  };
  const transactions = { create: jest.fn(async () => ({ success: true })) };
  const credits = { recordPayment: jest.fn(async () => ({ id: 'cr_1' })) };
  const tieredPricing = { upsertRules: jest.fn(async () => []) };

  const service = new WholesaleAssistantToolsService(
    { db } as never,
    transactions as never,
    credits as never,
    tieredPricing as never,
  );
  const byName = (name: string): ToolDefinition => {
    const tool = service.all().find((entry) => entry.name === name);
    if (!tool) throw new Error(`missing tool ${name}`);
    return tool;
  };
  return { service, db, transactions, credits, tieredPricing, byName };
}

describe('WholesaleAssistantToolsService vertical gating', () => {
  it('gates every wholesaler tool to the WHOLESALER vertical', () => {
    const { service } = build();
    const tools = service.all();
    expect(tools).toHaveLength(7);
    for (const tool of tools) {
      expect(tool.verticals).toEqual(['WHOLESALER']);
    }
  });

  it('restricts credit payments and pricing to owners and managers', () => {
    const { byName } = build();
    expect(byName('record_credit_payment').roles).toEqual([
      AppRole.OWNER,
      AppRole.MANAGER,
    ]);
    expect(byName('create_tiered_price').roles).toEqual([
      AppRole.OWNER,
      AppRole.MANAGER,
    ]);
  });
});

describe('WholesaleAssistantToolsService.list_debtors', () => {
  it('scopes to the organization, computes balances and drops settled rows', async () => {
    const h = build();
    h.db.creditRecord.findMany.mockResolvedValue([
      {
        id: 'cr_1',
        clientName: 'Mama Mboga',
        amountTotal: 10000,
        amountPaid: 4000,
        status: 'PARTIAL',
        dueDate: null,
        transaction: { item: { name: 'Sugar' } },
      },
      {
        id: 'cr_2',
        clientName: 'Ali',
        amountTotal: 5000,
        amountPaid: 5000,
        status: 'PARTIAL',
        dueDate: null,
        transaction: { item: { name: 'Rice' } },
      },
    ]);

    const result = (await h
      .byName('list_debtors')
      .execute?.({}, CTX)) as Array<{ creditId: string; balance: number }>;

    expect(h.db.creditRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org_1' }),
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({ creditId: 'cr_1', balance: 6000 }),
    ]);
  });
});

describe('WholesaleAssistantToolsService.list_packaging_units', () => {
  it('returns the packaging units for a scoped item', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue({
      ...ITEM,
      packaging: [
        { id: 'pk_1', name: 'Carton of 24', quantityPerUnit: 24, sellingPrice: 2500 },
      ],
    });

    const result = (await h
      .byName('list_packaging_units')
      .execute?.({ itemId: 'item_1' }, CTX)) as {
      packagingUnits: unknown[];
    };

    expect(result.packagingUnits).toEqual([
      { id: 'pk_1', name: 'Carton of 24', quantityPerUnit: 24, sellingPrice: 2500 },
    ]);
  });
});

describe('WholesaleAssistantToolsService.get_top_sellers', () => {
  it('groups sales and resolves item names', async () => {
    const h = build();
    h.db.inventoryTransaction.groupBy.mockResolvedValue([
      { itemId: 'item_1', _sum: { quantityChange: -240 } },
    ]);
    h.db.inventoryItem.findMany.mockResolvedValue([
      { id: 'item_1', name: 'Sugar', unit: 'kg' },
    ]);

    const result = (await h
      .byName('get_top_sellers')
      .execute?.({ days: 7 }, CTX)) as { topSellers: unknown[] };

    expect(result.topSellers).toEqual([
      { itemId: 'item_1', name: 'Sugar', unit: 'kg', totalSold: 240 },
    ]);
  });
});

describe('WholesaleAssistantToolsService.record_wholesale_sale', () => {
  it('checks stock, projects the movement and commits with the client', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue(ITEM);

    const draft = await h.byName('record_wholesale_sale').buildProposal?.(
      {
        itemId: 'item_1',
        quantity: 50,
        clientName: 'Mama Mboga',
        isCredit: true,
        dueDate: '2026-11-01',
      },
      CTX,
    );

    expect(draft?.diff).toEqual({
      item: 'Sugar',
      quantity: { before: 500, after: 450 },
    });
    expect(draft?.summary).toContain('on credit');

    await h.byName('record_wholesale_sale').commit?.(draft?.args ?? {}, CTX);
    expect(h.transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'item_1',
        type: 'SALE',
        quantity: 50,
        clientName: 'Mama Mboga',
        isCredit: true,
      }),
      'org_1',
      expect.objectContaining({ actorId: 'user_1' }),
    );
  });

  it('requires a client name for a credit sale', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue(ITEM);
    await expect(
      h.byName('record_wholesale_sale').buildProposal?.(
        { itemId: 'item_1', quantity: 50, isCredit: true },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to sell more than is in stock', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue({ ...ITEM, quantity: 10 });
    await expect(
      h.byName('record_wholesale_sale').buildProposal?.(
        { itemId: 'item_1', quantity: 50 },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('WholesaleAssistantToolsService.record_bulk_sale', () => {
  it('multiplies cartons by the packaging size and commits base units', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue({
      ...ITEM,
      packaging: [
        { id: 'pk_1', name: 'Carton of 24', quantityPerUnit: 24, sellingPrice: 2500 },
      ],
    });

    const draft = await h.byName('record_bulk_sale').buildProposal?.(
      { itemId: 'item_1', cartons: 10, clientName: 'Mama Mboga' },
      CTX,
    );

    expect(draft?.summary).toContain('10 Carton of 24 (240 kg)');
    expect(draft?.diff).toEqual({
      item: 'Sugar',
      quantity: { before: 500, after: 260 },
    });

    await h.byName('record_bulk_sale').commit?.(draft?.args ?? {}, CTX);
    expect(h.transactions.create).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 240, clientName: 'Mama Mboga' }),
      'org_1',
      expect.any(Object),
    );
  });

  it('requires an explicit packaging unit when several exist', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue({
      ...ITEM,
      packaging: [
        { id: 'pk_1', name: 'Carton of 24', quantityPerUnit: 24, sellingPrice: 2500 },
        { id: 'pk_2', name: 'Sack of 50', quantityPerUnit: 50, sellingPrice: 5000 },
      ],
    });
    await expect(
      h.byName('record_bulk_sale').buildProposal?.(
        { itemId: 'item_1', cartons: 2, clientName: 'Ali' },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses the chosen packaging unit when several exist', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue({
      ...ITEM,
      packaging: [
        { id: 'pk_1', name: 'Carton of 24', quantityPerUnit: 24, sellingPrice: 2500 },
        { id: 'pk_2', name: 'Sack of 50', quantityPerUnit: 50, sellingPrice: 5000 },
      ],
    });
    const draft = await h.byName('record_bulk_sale').buildProposal?.(
      {
        itemId: 'item_1',
        cartons: 2,
        clientName: 'Ali',
        packagingUnitId: 'pk_2',
      },
      CTX,
    );
    expect(draft?.args).toMatchObject({ packagingUnitId: 'pk_2' });
    expect(draft?.diff).toEqual({
      item: 'Sugar',
      quantity: { before: 500, after: 400 },
    });
  });
});

describe('WholesaleAssistantToolsService.record_credit_payment', () => {
  it('projects the balance change and commits the payment', async () => {
    const h = build();
    h.db.creditRecord.findFirst.mockResolvedValue({
      id: 'cr_1',
      clientName: 'Mama Mboga',
      amountTotal: 10000,
      amountPaid: 4000,
      status: 'PARTIAL',
    });

    const draft = await h.byName('record_credit_payment').buildProposal?.(
      { creditId: 'cr_1', amount: 2500 },
      CTX,
    );
    expect(draft?.diff).toEqual({ balance: { before: 6000, after: 3500 } });

    await h.byName('record_credit_payment').commit?.(draft?.args ?? {}, CTX);
    expect(h.credits.recordPayment).toHaveBeenCalledWith(
      'cr_1',
      'org_1',
      expect.objectContaining({ amount: 2500 }),
    );
  });

  it('refuses an unknown credit record', async () => {
    const h = build();
    h.db.creditRecord.findFirst.mockResolvedValue(null);
    await expect(
      h.byName('record_credit_payment').buildProposal?.(
        { creditId: 'other', amount: 1000 },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('WholesaleAssistantToolsService.create_tiered_price', () => {
  it('validates and commits tiers with the item id attached', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue(ITEM);

    const draft = await h.byName('create_tiered_price').buildProposal?.(
      {
        itemId: 'item_1',
        tiers: [
          { minQuantity: 10, pricePerUnit: 110, label: 'Bulk' },
          { minQuantity: 50, pricePerUnit: 100 },
        ],
      },
      CTX,
    );
    expect(draft?.summary).toContain('2 wholesale price tiers');

    await h.byName('create_tiered_price').commit?.(draft?.args ?? {}, CTX);
    expect(h.tieredPricing.upsertRules).toHaveBeenCalledWith('org_1', 'item_1', [
      { minQuantity: 10, pricePerUnit: 110, label: 'Bulk', inventoryItemId: 'item_1' },
      { minQuantity: 50, pricePerUnit: 100, label: undefined, inventoryItemId: 'item_1' },
    ]);
  });

  it('rejects an empty tier list', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue(ITEM);
    await expect(
      h.byName('create_tiered_price').buildProposal?.(
        { itemId: 'item_1', tiers: [] },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
