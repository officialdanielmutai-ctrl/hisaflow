import { BadRequestException } from '@nestjs/common';
import { RestaurantAssistantToolsService } from './restaurant-assistant-tools.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import type { ToolContext, ToolDefinition } from '../tool.types';

const CTX = {
  organizationId: 'org_1',
  userId: 'user_1',
  role: AppRole.OWNER,
  businessType: 'RESTAURANT',
  tier: 'SOLO',
  isImpersonated: false,
} satisfies ToolContext;

const DISH = {
  id: 'item_1',
  name: 'Biryani',
  unit: 'plate',
  quantity: 0,
  sellingPrice: 600,
  isComposite: true,
  recipeLines: [
    {
      quantityUsed: 0.2,
      ingredient: { id: 'ing_1', name: 'Rice', unit: 'kg', quantity: 10 },
    },
    {
      quantityUsed: 0.1,
      ingredient: { id: 'ing_2', name: 'Chicken', unit: 'kg', quantity: 5 },
    },
  ],
};

const SODA = {
  id: 'item_2',
  name: 'Soda',
  unit: 'bottle',
  quantity: 24,
  sellingPrice: 100,
  isComposite: false,
  recipeLines: [],
};

const ORDER = {
  id: 'ord_1',
  tableLabel: 'Table 3',
  status: 'OPEN',
  notes: null,
  items: [
    { quantity: 2, item: DISH },
    { quantity: 3, item: SODA },
  ],
};

type MockFn = jest.Mock;

interface Harness {
  service: RestaurantAssistantToolsService;
  db: {
    inventoryItem: { findFirst: MockFn; findMany: MockFn };
    tableOrder: { findFirst: MockFn; findMany: MockFn };
  };
  tableOrders: { create: MockFn; addItem: MockFn; closeOrder: MockFn };
  inventory: { updateVariant: MockFn };
  transactions: { create: MockFn };
  byName: (name: string) => ToolDefinition;
}

function build(): Harness {
  const db = {
    inventoryItem: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    tableOrder: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
  };
  const tableOrders = {
    create: jest.fn(async () => ({ id: 'ord_new' })),
    addItem: jest.fn(async () => ({ id: 'oi_1' })),
    closeOrder: jest.fn(async () => ({ id: 'ord_1', status: 'PAID' })),
  };
  const inventory = { updateVariant: jest.fn(async () => ({ id: 'item_1' })) };
  const transactions = { create: jest.fn(async () => ({ success: true })) };

  const service = new RestaurantAssistantToolsService(
    { db } as never,
    tableOrders as never,
    inventory as never,
    transactions as never,
  );
  const byName = (name: string): ToolDefinition => {
    const tool = service.all().find((entry) => entry.name === name);
    if (!tool) throw new Error(`missing tool ${name}`);
    return tool;
  };
  return { service, db, tableOrders, inventory, transactions, byName };
}

describe('RestaurantAssistantToolsService vertical gating', () => {
  it('gates every restaurant tool to the RESTAURANT vertical', () => {
    const { service } = build();
    const tools = service.all();
    expect(tools).toHaveLength(8);
    for (const tool of tools) {
      expect(tool.verticals).toEqual(['RESTAURANT']);
    }
  });

  it('restricts menu pricing to owners and managers', () => {
    const { byName } = build();
    expect(byName('update_menu_price').roles).toEqual([
      AppRole.OWNER,
      AppRole.MANAGER,
    ]);
  });
});

describe('RestaurantAssistantToolsService.get_open_tables', () => {
  it('lists open orders with computed totals', async () => {
    const h = build();
    h.db.tableOrder.findMany.mockResolvedValue([
      {
        id: 'ord_1',
        tableLabel: 'Table 3',
        notes: null,
        createdAt: new Date('2026-10-12T10:00:00Z'),
        items: [
          {
            itemId: 'item_1',
            quantity: 2,
            unitPrice: 600,
            item: { id: 'item_1', name: 'Biryani', unit: 'plate' },
          },
        ],
      },
    ]);

    const result = (await h
      .byName('get_open_tables')
      .execute?.({}, CTX)) as Array<{ total: number }>;

    expect(h.db.tableOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org_1', status: 'OPEN' },
      }),
    );
    expect(result[0].total).toBe(1200);
  });
});

describe('RestaurantAssistantToolsService.listMenuItems', () => {
  it('returns numeric prices and composite flags', async () => {
    const h = build();
    h.db.inventoryItem.findMany.mockResolvedValue([
      { ...DISH, sellingPrice: 600 },
    ]);
    const result = (await h
      .byName('list_menu_items')
      .execute?.({}, CTX)) as Array<{ sellingPrice: number; isComposite: boolean }>;
    expect(result[0]).toMatchObject({ sellingPrice: 600, isComposite: true });
  });
});

describe('RestaurantAssistantToolsService.get_menu_item_recipe', () => {
  it('returns the ingredients of a composite dish', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue(DISH);
    const result = (await h
      .byName('get_menu_item_recipe')
      .execute?.({ itemId: 'item_1' }, CTX)) as {
      isComposite: boolean;
      ingredients: unknown[];
    };
    expect(result.isComposite).toBe(true);
    expect(result.ingredients).toHaveLength(2);
  });
});

describe('RestaurantAssistantToolsService.create_table_order', () => {
  it('falls back to the menu price and commits through the service', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        where.id === 'item_1' ? DISH : SODA,
    );

    const draft = await h.byName('create_table_order').buildProposal?.(
      {
        tableLabel: 'Table 5',
        items: [
          { itemId: 'item_1', quantity: 2 },
          { itemId: 'item_2', quantity: 3, unitPrice: 120 },
        ],
      },
      CTX,
    );

    expect(draft?.summary).toContain('KES 1,560');
    await h.byName('create_table_order').commit?.(draft?.args ?? {}, CTX);
    expect(h.tableOrders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tableLabel: 'Table 5',
        items: [
          { itemId: 'item_1', quantity: 2, unitPrice: 600, notes: undefined },
          { itemId: 'item_2', quantity: 3, unitPrice: 120, notes: undefined },
        ],
      }),
      'org_1',
    );
  });
});

describe('RestaurantAssistantToolsService.add_order_item', () => {
  it('refuses a non-open order', async () => {
    const h = build();
    h.db.tableOrder.findFirst.mockResolvedValue({ ...ORDER, status: 'PAID' });
    await expect(
      h.byName('add_order_item').buildProposal?.(
        { orderId: 'ord_1', itemId: 'item_2', quantity: 1 },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses the menu price and commits the item', async () => {
    const h = build();
    h.db.tableOrder.findFirst.mockResolvedValue(ORDER);
    h.db.inventoryItem.findFirst.mockResolvedValue(SODA);

    const draft = await h.byName('add_order_item').buildProposal?.(
      { orderId: 'ord_1', itemId: 'item_2', quantity: 2 },
      CTX,
    );
    expect(draft?.args).toMatchObject({
      orderId: 'ord_1',
      itemId: 'item_2',
      quantity: 2,
      unitPrice: 100,
    });

    await h.byName('add_order_item').commit?.(draft?.args ?? {}, CTX);
    expect(h.tableOrders.addItem).toHaveBeenCalledWith(
      'ord_1',
      { itemId: 'item_2', quantity: 2, unitPrice: 100, notes: undefined },
      'org_1',
    );
  });
});

describe('RestaurantAssistantToolsService.close_table_order', () => {
  it('plans composite ingredients and plain item deductions, then commits', async () => {
    const h = build();
    h.db.tableOrder.findFirst.mockResolvedValue(ORDER);

    const draft = await h
      .byName('close_table_order')
      .buildProposal?.({ orderId: 'ord_1' }, CTX);

    expect(draft?.diff).toMatchObject({
      'Rice (kg)': { before: 10, after: 9.6 },
      'Chicken (kg)': { before: 5, after: 4.8 },
      'Soda (bottle)': { before: 24, after: 21 },
    });

    await h.byName('close_table_order').commit?.({ orderId: 'ord_1' }, CTX);
    expect(h.tableOrders.closeOrder).toHaveBeenCalledWith('ord_1', 'org_1');
  });

  it('refuses to close when an ingredient is short', async () => {
    const h = build();
    h.db.tableOrder.findFirst.mockResolvedValue({
      ...ORDER,
      items: [
        {
          quantity: 2,
          item: {
            ...DISH,
            recipeLines: [
              {
                quantityUsed: 0.2,
                ingredient: { id: 'ing_1', name: 'Rice', unit: 'kg', quantity: 0.1 },
              },
            ],
          },
        },
      ],
    });
    await expect(
      h.byName('close_table_order').buildProposal?.({ orderId: 'ord_1' }, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('RestaurantAssistantToolsService.record_recipe_consumption', () => {
  it('refuses a non-composite item', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue(SODA);
    await expect(
      h.byName('record_recipe_consumption').buildProposal?.(
        { itemId: 'item_2', quantity: 1 },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deducts ingredients and commits a SALE transaction', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue(DISH);

    const draft = await h
      .byName('record_recipe_consumption')
      .buildProposal?.({ itemId: 'item_1', quantity: 3 }, CTX);
    expect(draft?.diff).toMatchObject({
      'Rice (kg)': { before: 10, after: 9.4 },
      'Chicken (kg)': { before: 5, after: 4.7 },
    });

    await h
      .byName('record_recipe_consumption')
      .commit?.({ itemId: 'item_1', quantity: 3 }, CTX);
    expect(h.transactions.create).toHaveBeenCalledWith(
      { itemId: 'item_1', type: 'SALE', quantity: 3, note: undefined },
      'org_1',
      expect.objectContaining({ actorId: 'user_1' }),
    );
  });
});

describe('RestaurantAssistantToolsService.update_menu_price', () => {
  it('shows the price change and commits the variant update', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue(DISH);

    const draft = await h.byName('update_menu_price').buildProposal?.(
      { itemId: 'item_1', sellingPrice: 650 },
      CTX,
    );
    expect(draft?.diff).toEqual({
      sellingPrice: { before: 600, after: 650 },
    });

    await h.byName('update_menu_price').commit?.(draft?.args ?? {}, CTX);
    expect(h.inventory.updateVariant).toHaveBeenCalledWith(
      'item_1',
      { sellingPrice: 650 },
      'org_1',
    );
  });

  it('rejects a negative price', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue(DISH);
    await expect(
      h.byName('update_menu_price').buildProposal?.(
        { itemId: 'item_1', sellingPrice: -5 },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
