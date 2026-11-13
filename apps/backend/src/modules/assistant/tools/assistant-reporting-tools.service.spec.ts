import { BadRequestException } from '@nestjs/common';
import { AssistantToolsService } from './assistant-tools.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import type { ToolContext, ToolDefinition } from '../tool.types';

const CTX = {
  organizationId: 'org_1',
  userId: 'user_1',
  role: AppRole.OWNER,
  businessType: 'DUKA',
  tier: 'SOLO',
  isImpersonated: false,
} satisfies ToolContext;

const DAY_MS = 24 * 60 * 60 * 1000;

function inRange(
  value: unknown,
  range?: { gte?: Date; lte?: Date },
): boolean {
  if (!(value instanceof Date) || !range) return true;
  if (range.gte && value < range.gte) return false;
  if (range.lte && value > range.lte) return false;
  return true;
}

interface BuildOptions {
  items?: Array<Record<string, unknown>>;
  transactions?: Array<Record<string, unknown>>;
  businessTransactions?: Array<Record<string, unknown>>;
  credits?: Array<Record<string, unknown>>;
  alerts?: Array<Record<string, unknown>>;
  taxRecords?: Array<Record<string, unknown>>;
  taxRegistration?: Record<string, unknown> | null;
  members?: Array<Record<string, unknown>>;
  notesList?: Array<Record<string, unknown>>;
}

function build(options: BuildOptions = {}) {
  const items = options.items ?? [];
  const inventoryTransactions = options.transactions ?? [];
  const businessTxRecords = options.businessTransactions ?? [];
  const credits = options.credits ?? [];
  const alerts = options.alerts ?? [];
  const taxRecords = options.taxRecords ?? [];
  const members = options.members ?? [];
  const notesList = options.notesList ?? [];

  const db = {
    inventoryItem: {
      findMany: jest.fn(async () => items),
      findFirst: jest.fn(async () => items[0] ?? null),
    },
    inventoryTransaction: {
      findMany: jest.fn(
        async (query: {
          where?: {
            type?: string;
            itemId?: string;
            createdAt?: { gte?: Date; lte?: Date };
          };
        }) =>
          inventoryTransactions.filter((tx) => {
            const where = query?.where ?? {};
            if (where.type && tx.type !== where.type) return false;
            if (where.itemId && tx.itemId !== where.itemId) return false;
            return inRange(tx.createdAt, where.createdAt);
          }),
      ),
    },
    businessTransaction: {
      findMany: jest.fn(
        async (query: {
          where?: { type?: string; date?: { gte?: Date; lte?: Date } };
        }) =>
          businessTxRecords.filter((tx) => {
            const where = query?.where ?? {};
            if (where.type && tx.type !== where.type) return false;
            return inRange(tx.date, where.date);
          }),
      ),
    },
    creditRecord: {
      findMany: jest.fn(async () => credits),
    },
    alert: {
      findMany: jest.fn(async () =>
        alerts.filter((alert) => alert.status === 'UNRESOLVED'),
      ),
      findFirst: jest.fn(
        async (query: { where?: { id?: string } }) =>
          alerts.find((alert) => alert.id === query?.where?.id) ?? null,
      ),
      count: jest.fn(
        async () =>
          alerts.filter((alert) => alert.status === 'UNRESOLVED').length,
      ),
    },
    taxInvoiceRecord: {
      findMany: jest.fn(
        async (query: {
          where?: { createdAt?: { gte?: Date; lte?: Date } };
        }) =>
          taxRecords.filter((record) =>
            inRange(record.createdAt, query?.where?.createdAt),
          ),
      ),
    },
    taxRegistration: {
      findUnique: jest.fn(async () => options.taxRegistration ?? null),
    },
    orgMembership: {
      findMany: jest.fn(async () => members),
    },
  };

  const notes = {
    create: jest.fn(async () => ({ id: 'note_1' })),
    findAll: jest.fn(async () => notesList),
  };
  const transactions = { create: jest.fn(async () => ({ id: 'tx_1' })) };
  const inventory = {
    create: jest.fn(async () => ({ id: 'product_1' })),
    updateVariant: jest.fn(async () => ({ id: 'i1' })),
    deleteVariant: jest.fn(async () => ({ id: 'i1', isActive: false })),
  };
  const comms = {
    assertConsent: jest.fn(async () => undefined),
    send: jest.fn(async () => ({ status: 'MOCKED', recipient: 'x' })),
  };
  const unsupported = { record: jest.fn(async () => ({ recorded: true })) };
  const finance = {
    getBreakdown: jest.fn(async () => ({
      businessType: 'DUKA',
      revenue: 1000,
      cogs: 400,
      grossProfit: 600,
      grossMarginPct: 60,
      otherIncome: 50,
      operatingExpenses: 200,
      maintenanceCosts: 0,
      netProfit: 450,
      netMarginPct: 42.9,
      dailyTrend: [],
      expensesByCategory: [],
      breakdowns: [],
      leaks: [],
    })),
  };
  const financeSearch = {
    search: jest.fn(async () => ({
      businessType: 'DUKA',
      period: 'rolling30',
      totalMatched: 0,
      results: [],
    })),
  };
  const businessTransactions = {
    createBusinessTransaction: jest.fn(async () => ({ id: 'business_1' })),
  };
  const alertsService = {
    resolveAlert: jest.fn(async () => ({ id: 'a1', status: 'RESOLVED' })),
    resolveAllAlerts: jest.fn(async () => ({ resolved: 1 })),
  };

  const service = new AssistantToolsService(
    { db } as never,
    inventory as never,
    notes as never,
    transactions as never,
    comms as never,
    unsupported as never,
    finance as never,
    financeSearch as never,
    businessTransactions as never,
    alertsService as never,
  );

  const byName = (name: string): ToolDefinition => {
    const tool = service.all().find((entry) => entry.name === name);
    if (!tool) throw new Error(`missing tool ${name}`);
    return tool;
  };

  return {
    service,
    db,
    inventory,
    notes,
    transactions,
    comms,
    unsupported,
    finance,
    financeSearch,
    businessTransactions,
    alertsService,
    byName,
  };
}

function sale(
  id: string,
  createdAt: Date,
  quantity: number,
  options: {
    source?: string;
    appliedTierPrice?: number;
    name?: string;
    category?: string;
    costPrice?: number;
    sellingPrice?: number;
  } = {},
) {
  return {
    id,
    organizationId: 'org_1',
    itemId: 'i1',
    type: 'SALE',
    quantityChange: -quantity,
    quantityBefore: 100,
    quantityAfter: 100 - quantity,
    source: options.source ?? 'manual',
    metadata: options.appliedTierPrice
      ? { appliedTierPrice: options.appliedTierPrice }
      : null,
    createdAt,
    item: {
      id: 'i1',
      name: options.name ?? 'Sugar',
      unit: 'kg',
      category: options.category ?? 'Grocery',
      costPrice: options.costPrice ?? 100,
      sellingPrice: options.sellingPrice ?? 150,
    },
  };
}

describe('AssistantToolsService.get_sales_report', () => {
  const now = new Date();

  it('reports revenue, margin, credit and a previous-period comparison', async () => {
    const { byName } = build({
      transactions: [
        sale('t1', now, 3),
        sale('t2', now, 2, { source: 'credit', appliedTierPrice: 200 }),
        sale('t3', new Date(now.getTime() - 10 * DAY_MS), 4, {
          costPrice: 60,
          sellingPrice: 100,
        }),
      ],
      credits: [{ amountTotal: 500, amountPaid: 200 }],
    });

    const result: any = await byName('get_sales_report').execute?.(
      { days: 7 },
      CTX,
    );

    expect(result.totalSales).toBe(2);
    expect(result.revenue).toBe(850);
    expect(result.costOfSales).toBe(500);
    expect(result.grossProfit).toBe(350);
    expect(result.grossMarginPct).toBe(41.18);
    expect(result.averageSaleValue).toBe(425);
    expect(result.creditSales).toEqual({
      count: 1,
      revenue: 400,
      outstanding: 300,
    });
    expect(result.comparedWithPreviousPeriod).toMatchObject({
      revenue: 400,
      units: 4,
      sales: 1,
      revenueChangePct: 112.5,
      direction: 'up',
    });
    expect(result.topItems[0]).toMatchObject({
      name: 'Sugar',
      units: 5,
      revenue: 850,
    });
    expect(result.byCategory[0]).toMatchObject({
      category: 'Grocery',
      units: 5,
      revenue: 850,
    });
  });

  it('reports zero sales honestly instead of throwing', async () => {
    const { byName } = build();
    const result: any = await byName('get_sales_report').execute?.({}, CTX);
    expect(result).toMatchObject({
      totalSales: 0,
      revenue: 0,
      grossProfit: 0,
      averageSaleValue: 0,
      topItems: [],
    });
  });
});

describe('AssistantToolsService.analyse_catalogue', () => {
  it('finds fast movers, dead stock, margin risks and new-item ideas', async () => {
    const { byName } = build({
      items: [
        {
          id: 'i1',
          name: 'Sugar',
          unit: 'kg',
          category: 'Grocery',
          quantity: 2,
          reorderThreshold: 5,
          costPrice: 80,
          sellingPrice: 100,
          packaging: [],
        },
        {
          id: 'i2',
          name: 'Slow juice',
          unit: 'bottle',
          category: 'Drinks',
          quantity: 20,
          reorderThreshold: 0,
          costPrice: 50,
          sellingPrice: 60,
          packaging: [],
        },
        {
          id: 'i3',
          name: 'Thin-margin milk',
          unit: 'litre',
          category: 'Dairy',
          quantity: 10,
          reorderThreshold: 2,
          costPrice: 100,
          sellingPrice: 100,
          packaging: [],
        },
      ],
      transactions: [
        {
          id: 't1',
          itemId: 'i1',
          type: 'SALE',
          quantityChange: -10,
          metadata: null,
          createdAt: new Date(),
        },
      ],
    });

    const result: any = await byName('analyse_catalogue').execute?.(
      { days: 30, limit: 5 },
      CTX,
    );

    expect(result.catalogueSize).toBe(3);
    expect(result.topSellers[0]).toMatchObject({ name: 'Sugar', unitsSold: 10 });
    expect(result.lowStock.map((item: { name: string }) => item.name)).toContain(
      'Sugar',
    );
    expect(
      result.slowMovers.map((item: { name: string }) => item.name),
    ).toContain('Slow juice');
    expect(
      result.marginRisks.map((item: { name: string }) => item.name),
    ).toContain('Thin-margin milk');
    expect(
      result.packagingGaps.map((item: { name: string }) => item.name),
    ).toContain('Sugar');
    expect(result.suggestedNewItems[0]).toMatchObject({ category: 'Grocery' });
    expect(result.suggestions.map((item: { type: string }) => item.type)).toEqual(
      expect.arrayContaining([
        'restock',
        'pack_size',
        'category_gap',
        'price_review',
        'dead_stock',
      ]),
    );
  });

  it('states plainly when the catalogue is empty', async () => {
    const { byName } = build();
    const result: any = await byName('analyse_catalogue').execute?.({}, CTX);
    expect(result.catalogueSize).toBe(0);
    expect(result.note).toContain('no active catalogue items');
  });
});

describe('AssistantToolsService.get_purchase_report', () => {
  it('aggregates restocking at cost and names the top items', async () => {
    const { byName } = build({
      transactions: [
        {
          id: 'p1',
          itemId: 'i1',
          type: 'PURCHASE',
          quantityChange: 10,
          createdAt: new Date(),
          item: {
            id: 'i1',
            name: 'Cooking oil',
            unit: 'litres',
            category: 'Grocery',
            costPrice: 250,
          },
        },
      ],
    });

    const result: any = await byName('get_purchase_report').execute?.(
      { days: 30 },
      CTX,
    );

    expect(result.totalPurchases).toBe(1);
    expect(result.totalUnits).toBe(10);
    expect(result.totalCost).toBe(2500);
    expect(result.topItems[0]).toMatchObject({
      name: 'Cooking oil',
      units: 10,
      cost: 2500,
    });
  });
});

describe('AssistantToolsService.get_credit_summary', () => {
  it('summarises outstanding balances and ageing buckets', async () => {
    const dueDate = new Date(Date.now() - 45 * DAY_MS);
    const { byName } = build({
      credits: [
        {
          id: 'c1',
          clientName: 'Mama Njeri',
          amountTotal: 1000,
          amountPaid: 200,
          status: 'PARTIAL',
          dueDate,
          createdAt: dueDate,
          transaction: { item: { name: 'Sugar' } },
        },
      ],
    });

    const result: any = await byName('get_credit_summary').execute?.({}, CTX);

    expect(result.debtorCount).toBe(1);
    expect(result.totalOutstanding).toBe(800);
    expect(result.aging.days31to60).toBe(800);
    expect(result.debtors[0]).toMatchObject({
      clientName: 'Mama Njeri',
      balance: 800,
      item: 'Sugar',
    });
  });
});

describe('AssistantToolsService.get_expense_report', () => {
  it('groups recorded running costs by category', async () => {
    const { byName } = build({
      businessTransactions: [
        {
          id: 'e1',
          type: 'EXPENSE',
          category: 'RENT',
          amount: 15000,
          description: 'Shop rent',
          date: new Date(),
        },
        {
          id: 'e2',
          type: 'EXPENSE',
          category: 'TRANSPORT',
          amount: 800,
          description: 'Delivery',
          date: new Date(),
        },
      ],
    });

    const result: any = await byName('get_expense_report').execute?.(
      { days: 30 },
      CTX,
    );

    expect(result.totalExpenses).toBe(15800);
    expect(result.byCategory[0]).toEqual({
      category: 'RENT',
      count: 1,
      total: 15000,
    });
    expect(result.recent).toHaveLength(2);
  });
});

describe('AssistantToolsService.get_active_alerts', () => {
  it('returns only unresolved alerts with their evidence', async () => {
    const { byName } = build({
      alerts: [
        {
          id: 'a1',
          type: 'LOW_STOCK',
          severity: 'WARNING',
          status: 'UNRESOLVED',
          title: 'Sugar is running low',
          description: 'Sugar has 2 kg left.',
          createdAt: new Date(),
          item: { name: 'Sugar' },
        },
        {
          id: 'a2',
          type: 'DEAD_STOCK',
          severity: 'INFO',
          status: 'RESOLVED',
          title: 'Old alert',
          description: 'Should not be returned.',
          createdAt: new Date(),
          item: null,
        },
      ],
    });

    const result: any = await byName('get_active_alerts').execute?.({}, CTX);

    expect(result.count).toBe(1);
    expect(result.alerts[0]).toMatchObject({
      id: 'a1',
      severity: 'WARNING',
      item: 'Sugar',
    });
  });
});

describe('AssistantToolsService.get_recent_transactions', () => {
  it('lists recent movements and totals them by type', async () => {
    const { byName } = build({
      transactions: [
        {
          id: 't1',
          type: 'SALE',
          quantityBefore: 20,
          quantityChange: -3,
          quantityAfter: 17,
          clientName: 'Otieno',
          reason: null,
          source: 'manual',
          createdAt: new Date(),
          item: { id: 'i1', name: 'Sugar', unit: 'kg' },
        },
        {
          id: 't2',
          type: 'PURCHASE',
          quantityBefore: 17,
          quantityChange: 10,
          quantityAfter: 27,
          clientName: null,
          reason: 'Supplier delivery',
          source: 'manual',
          createdAt: new Date(),
          item: { id: 'i1', name: 'Sugar', unit: 'kg' },
        },
      ],
    });

    const result: any = await byName('get_recent_transactions').execute?.(
      {},
      CTX,
    );

    expect(result.count).toBe(2);
    expect(result.totalsByType).toEqual({
      SALE: { movements: 1, units: 3 },
      PURCHASE: { movements: 1, units: 10 },
    });
    expect(result.movements[0]).toMatchObject({
      type: 'SALE',
      item: 'Sugar',
      quantityChange: -3,
      clientName: 'Otieno',
    });
  });

  it('filters by movement type and rejects an unknown type', async () => {
    const { byName, db } = build({
      transactions: [
        {
          id: 't1',
          type: 'SALE',
          quantityBefore: 20,
          quantityChange: -3,
          quantityAfter: 17,
          clientName: null,
          reason: null,
          source: 'manual',
          createdAt: new Date(),
          item: { id: 'i1', name: 'Sugar', unit: 'kg' },
        },
        {
          id: 't2',
          type: 'PURCHASE',
          quantityBefore: 17,
          quantityChange: 10,
          quantityAfter: 27,
          clientName: null,
          reason: null,
          source: 'manual',
          createdAt: new Date(),
          item: { id: 'i1', name: 'Sugar', unit: 'kg' },
        },
      ],
    });

    const result: any = await byName('get_recent_transactions').execute?.(
      { type: 'purchase' },
      CTX,
    );
    expect(result.count).toBe(1);
    expect(result.movements[0].type).toBe('PURCHASE');
    expect(db.inventoryTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'PURCHASE' }),
      }),
    );

    await expect(
      byName('get_recent_transactions').execute?.({ type: 'NOPE' }, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AssistantToolsService.list_notes', () => {
  it('filters visible notes by status, importance and search text', async () => {
    const { byName, notes } = build({
      notesList: [
        {
          id: 'n1',
          title: 'Call the plumber',
          content: 'The sink is leaking',
          importance: 'HIGH',
          status: 'OPEN',
          dueDate: new Date('2026-11-20T09:00:00Z'),
          isPinned: false,
          author: { name: 'Owner' },
          checklistItems: [{ isCompleted: true }, { isCompleted: false }],
        },
        {
          id: 'n2',
          title: 'Order stock',
          content: 'Sugar and rice',
          importance: 'MEDIUM',
          status: 'COMPLETED',
          dueDate: null,
          isPinned: false,
          author: null,
          checklistItems: [],
        },
      ],
    });

    const result: any = await byName('list_notes').execute?.(
      { status: 'OPEN', query: 'plumber' },
      CTX,
    );

    expect(notes.findAll).toHaveBeenCalledWith('org_1', 'user_1', {
      status: 'OPEN',
    });
    expect(result.count).toBe(1);
    expect(result.notes[0]).toMatchObject({
      title: 'Call the plumber',
      importance: 'HIGH',
      checklist: { total: 2, completed: 1 },
      author: 'Owner',
    });
  });
});

describe('AssistantToolsService.get_tax_summary', () => {
  it('reports filed, pending and failed eTIMS invoices', async () => {
    const { byName } = build({
      taxRegistration: {
        status: 'PRODUCTION_ACTIVE',
        integrationType: 'VSCU',
        environment: 'PRODUCTION',
      },
      taxRecords: [
        {
          status: 'SYNCED',
          netAmount: 1000,
          taxAmount: 160,
          grossAmount: 1160,
          lastError: null,
          createdAt: new Date(),
          syncQueue: null,
        },
        {
          status: 'PENDING',
          netAmount: 500,
          taxAmount: 80,
          grossAmount: 580,
          lastError: null,
          createdAt: new Date(),
          syncQueue: { status: 'PENDING', lastError: null, attempts: 0 },
        },
        {
          status: 'FAILED',
          netAmount: 200,
          taxAmount: 32,
          grossAmount: 232,
          lastError: 'KRA timeout',
          createdAt: new Date(),
          syncQueue: { status: 'FAILED', lastError: 'KRA timeout', attempts: 3 },
        },
      ],
    });

    const result: any = await byName('get_tax_summary').execute?.({}, CTX);

    expect(result.registration).toMatchObject({
      status: 'PRODUCTION_ACTIVE',
      environment: 'PRODUCTION',
    });
    expect(result.summary).toEqual({
      filed: 1,
      pending: 1,
      failed: 1,
      taxableAmount: 1000,
      taxAmount: 160,
      grossAmount: 1160,
      pendingTaxAmount: 80,
    });
    expect(result.recentFailures[0]).toMatchObject({
      error: 'KRA timeout',
      attempts: 3,
    });
  });

  it('states plainly when there is no eTIMS registration', async () => {
    const { byName } = build();
    const result: any = await byName('get_tax_summary').execute?.({}, CTX);
    expect(result.registration).toBeNull();
    expect(result.note).toContain('No KRA eTIMS registration');
  });
});

describe('AssistantToolsService.list_team_members', () => {
  it('lists org-scoped members with their roles', async () => {
    const { byName } = build({
      members: [
        {
          userId: 'u1',
          role: 'OWNER',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          user: {
            id: 'u1',
            name: 'Daniel',
            email: 'daniel@example.com',
            phone: '0700000000',
          },
        },
      ],
    });

    const result: any = await byName('list_team_members').execute?.({}, CTX);

    expect(result.count).toBe(1);
    expect(result.members[0]).toMatchObject({
      name: 'Daniel',
      role: 'OWNER',
      email: 'daniel@example.com',
    });
  });
});

describe('AssistantToolsService.resolve_alert', () => {
  it('builds an individual alert proposal and commits through AlertsService', async () => {
    const { byName, alertsService } = build({
      alerts: [
        { id: 'a1', title: 'Sugar is running low', status: 'UNRESOLVED' },
      ],
    });
    const tool = byName('resolve_alert');

    const draft = await tool.buildProposal?.({ alertId: 'a1' }, CTX);
    expect(draft?.args).toEqual({ alertId: 'a1' });
    expect(draft?.summary).toContain('Sugar is running low');
    expect(alertsService.resolveAlert).not.toHaveBeenCalled();

    await tool.commit?.(draft?.args ?? {}, CTX);
    expect(alertsService.resolveAlert).toHaveBeenCalledWith('a1', 'org_1');
  });

  it('clears every unresolved alert when asked', async () => {
    const { byName, alertsService } = build({
      alerts: [
        { id: 'a1', title: 'Low stock', status: 'UNRESOLVED' },
        { id: 'a2', title: 'Dead stock', status: 'UNRESOLVED' },
      ],
    });
    const tool = byName('resolve_alert');

    const draft = await tool.buildProposal?.({ all: true }, CTX);
    expect(draft?.summary).toContain('2 unresolved alerts');

    await tool.commit?.(draft?.args ?? {}, CTX);
    expect(alertsService.resolveAllAlerts).toHaveBeenCalledWith('org_1');
  });

  it('refuses to build a proposal when there is nothing to clear', async () => {
    const { byName } = build();
    await expect(
      byName('resolve_alert').buildProposal?.({ all: true }, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AssistantToolsService.adjust_stock', () => {
  it('builds a counted stock correction and commits through InventoryService', async () => {
    const { byName, inventory } = build({
      items: [{ id: 'i1', name: 'Sugar', unit: 'kg', quantity: 20 }],
    });
    const tool = byName('adjust_stock');

    const draft = await tool.buildProposal?.(
      { itemId: 'i1', quantity: 12 },
      CTX,
    );
    expect(draft?.args).toEqual({ itemId: 'i1', quantity: 12 });
    expect(draft?.summary).toContain('from 20 to 12 kg');
    expect(draft?.diff).toEqual({
      item: 'Sugar',
      quantity: { before: 20, after: 12 },
    });

    await tool.commit?.(draft?.args ?? {}, CTX);
    expect(inventory.updateVariant).toHaveBeenCalledWith(
      'i1',
      { quantity: 12 },
      'org_1',
      'user_1',
    );
  });

  it('requires a counted quantity', async () => {
    const { byName } = build({
      items: [{ id: 'i1', name: 'Sugar', unit: 'kg', quantity: 20 }],
    });
    await expect(
      byName('adjust_stock').buildProposal?.({ itemId: 'i1' }, CTX),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AssistantToolsService.archive_inventory_item', () => {
  it('builds a soft-delete proposal and commits through InventoryService', async () => {
    const { byName, inventory } = build({
      items: [{ id: 'i1', name: 'Old stock', unit: 'kg', quantity: 0 }],
    });
    const tool = byName('archive_inventory_item');

    const draft = await tool.buildProposal?.({ itemId: 'i1' }, CTX);
    expect(draft?.summary).toContain('history is kept');
    expect(draft?.diff).toEqual({
      item: 'Old stock',
      isActive: { before: true, after: false },
    });
    expect(inventory.deleteVariant).not.toHaveBeenCalled();

    await tool.commit?.(draft?.args ?? {}, CTX);
    expect(inventory.deleteVariant).toHaveBeenCalledWith('i1', 'org_1');
  });
});

describe('AssistantToolsService.record_expense / record_income', () => {
  it('normalises an expense and commits it to the business ledger', async () => {
    const { byName, businessTransactions } = build();
    const tool = byName('record_expense');

    const draft = await tool.buildProposal?.(
      {
        category: 'rent',
        amount: 15000,
        description: 'Shop rent for November',
        date: '2026-11-01',
      },
      CTX,
    );
    expect(draft?.args).toMatchObject({
      type: 'EXPENSE',
      category: 'RENT',
      amount: 15000,
      description: 'Shop rent for November',
      isRecurring: false,
    });
    expect(businessTransactions.createBusinessTransaction).not.toHaveBeenCalled();

    await tool.commit?.(draft?.args ?? {}, CTX);
    expect(
      businessTransactions.createBusinessTransaction,
    ).toHaveBeenCalledWith(
      'org_1',
      expect.objectContaining({
        type: 'EXPENSE',
        category: 'RENT',
        amount: 15000,
        description: 'Shop rent for November',
      }),
    );
  });

  it('supports recurring income and rejects an unknown category', async () => {
    const { byName, businessTransactions } = build();

    const draft = await byName('record_income').buildProposal?.(
      {
        category: 'SERVICE_FEE',
        amount: 2500,
        recurrenceRule: 'MONTHLY',
      },
      CTX,
    );
    expect(draft?.args).toMatchObject({
      type: 'INCOME',
      category: 'SERVICE_FEE',
      isRecurring: true,
      recurrenceRule: 'MONTHLY',
    });

    await byName('record_income').commit?.(draft?.args ?? {}, CTX);
    expect(
      businessTransactions.createBusinessTransaction,
    ).toHaveBeenCalledWith(
      'org_1',
      expect.objectContaining({ type: 'INCOME', category: 'SERVICE_FEE' }),
    );

    expect(() =>
      byName('record_expense').buildProposal?.(
        { category: 'NOT_A_CATEGORY', amount: 10 },
        CTX,
      ),
    ).toThrow(BadRequestException);
  });
});
