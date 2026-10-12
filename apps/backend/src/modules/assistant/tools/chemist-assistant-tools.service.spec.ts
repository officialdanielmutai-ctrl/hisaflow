import { BadRequestException } from '@nestjs/common';
import { ChemistAssistantToolsService } from './chemist-assistant-tools.service';
import { AppRole } from '../../../core/decorators/roles.decorator';
import type { ToolContext, ToolDefinition } from '../tool.types';

const CTX = {
  organizationId: 'org_1',
  userId: 'user_1',
  role: AppRole.OWNER,
  businessType: 'CHEMIST',
  tier: 'SOLO',
  isImpersonated: false,
} satisfies ToolContext;

const ITEM = {
  id: 'item_1',
  name: 'Amoxil 500mg',
  unit: 'strip',
  quantity: 100,
};

const BATCH = {
  id: 'batch_1',
  batchNumber: 'B123',
  quantity: 20,
  expiryDate: new Date('2026-01-01T00:00:00.000Z'),
  inventoryItemId: 'item_1',
  inventoryItem: ITEM,
};

type MockFn = jest.Mock;

interface Harness {
  service: ChemistAssistantToolsService;
  db: {
    stockBatch: { findFirst: MockFn; findMany: MockFn };
    inventoryItem: { findFirst: MockFn; findMany: MockFn };
  };
  stockBatches: { create: MockFn };
  transactions: { create: MockFn };
  byName: (name: string) => ToolDefinition;
}

function build(): Harness {
  const db = {
    stockBatch: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
    inventoryItem: {
      findFirst: jest.fn(async () => null as unknown),
      findMany: jest.fn(async () => [] as unknown[]),
    },
  };
  const stockBatches = { create: jest.fn(async () => ({ id: 'batch_new' })) };
  const transactions = { create: jest.fn(async () => ({ success: true })) };

  const service = new ChemistAssistantToolsService(
    { db } as never,
    stockBatches as never,
    transactions as never,
  );
  const byName = (name: string): ToolDefinition => {
    const tool = service.all().find((entry) => entry.name === name);
    if (!tool) throw new Error(`missing tool ${name}`);
    return tool;
  };
  return { service, db, stockBatches, transactions, byName };
}

describe('ChemistAssistantToolsService vertical gating', () => {
  it('gates every chemist tool to the CHEMIST vertical', () => {
    const { service } = build();
    const tools = service.all();
    expect(tools).toHaveLength(4);
    for (const tool of tools) {
      expect(tool.verticals).toEqual(['CHEMIST']);
    }
  });
});

describe('ChemistAssistantToolsService.list_expiring_batches', () => {
  it('scopes to the organization and flags expired batches', async () => {
    const h = build();
    h.db.stockBatch.findMany.mockResolvedValue([
      {
        id: 'batch_1',
        batchNumber: 'B123',
        quantity: 5,
        expiryDate: new Date('2020-01-01T00:00:00.000Z'),
        inventoryItemId: 'item_1',
        inventoryItem: { name: 'Amoxil 500mg', unit: 'strip' },
      },
    ]);

    const result = (await h
      .byName('list_expiring_batches')
      .execute?.({ days: 30 }, CTX)) as {
      days: number;
      batches: Array<{ expired: boolean }>;
    };

    expect(h.db.stockBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org_1' }),
      }),
    );
    expect(result.days).toBe(30);
    expect(result.batches[0].expired).toBe(true);
  });

  it('caps the look-ahead window at 365 days', async () => {
    const h = build();
    await h
      .byName('list_expiring_batches')
      .execute?.({ days: 100000 }, CTX);
    const horizon = h.db.stockBatch.findMany.mock.calls[0][0].where.expiryDate.lte as Date;
    const days = Math.round((horizon.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    expect(days).toBeLessThanOrEqual(366);
  });
});

describe('ChemistAssistantToolsService.get_drug_info', () => {
  it('searches the organization inventory and returns numeric fields', async () => {
    const h = build();
    h.db.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'item_1',
        name: 'Amoxil 500mg',
        unit: 'strip',
        quantity: 100,
        costPrice: 80,
        sellingPrice: 120,
        batchNumber: 'B123',
        expiryDate: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const result = (await h
      .byName('get_drug_info')
      .execute?.({ query: 'Amoxil' }, CTX)) as Array<{
      sellingPrice: number;
      quantity: number;
    }>;

    expect(h.db.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org_1' }),
      }),
    );
    expect(result[0]).toMatchObject({ sellingPrice: 120, quantity: 100 });
  });
});

describe('ChemistAssistantToolsService.receive_stock_batch', () => {
  it('projects the stock increase and commits through the batch service', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue(ITEM);

    const draft = await h.byName('receive_stock_batch').buildProposal?.(
      {
        itemId: 'item_1',
        batchNumber: 'B124',
        expiryDate: '2027-12-31',
        quantity: 50,
        costPrice: 80,
      },
      CTX,
    );

    expect(draft?.diff).toEqual({ 'Amoxil 500mg': { before: 100, after: 150 } });
    expect(draft?.summary).toContain('batch B124');

    await h.byName('receive_stock_batch').commit?.(draft?.args ?? {}, CTX);
    expect(h.stockBatches.create).toHaveBeenCalledWith(
      {
        inventoryItemId: 'item_1',
        batchNumber: 'B124',
        expiryDate: new Date('2027-12-31').toISOString(),
        quantity: 50,
        costPrice: 80,
      },
      'org_1',
    );
  });

  it('rejects an invalid expiry date', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue(ITEM);
    await expect(
      h.byName('receive_stock_batch').buildProposal?.(
        {
          itemId: 'item_1',
          batchNumber: 'B124',
          expiryDate: 'soon',
          quantity: 50,
        },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an item outside the organization', async () => {
    const h = build();
    h.db.inventoryItem.findFirst.mockResolvedValue(null);
    await expect(
      h.byName('receive_stock_batch').buildProposal?.(
        {
          itemId: 'other',
          batchNumber: 'B124',
          expiryDate: '2027-12-31',
          quantity: 50,
        },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ChemistAssistantToolsService.record_expiry_writeoff', () => {
  it('shows the decrease and commits a WASTAGE transaction for the batch', async () => {
    const h = build();
    h.db.stockBatch.findFirst.mockResolvedValue(BATCH);

    const draft = await h
      .byName('record_expiry_writeoff')
      .buildProposal?.({ batchId: 'batch_1' }, CTX);

    expect(draft?.diff).toEqual({
      'Amoxil 500mg': { before: 100, after: 80 },
    });
    expect(draft?.summary).toContain('batch B123');

    await h
      .byName('record_expiry_writeoff')
      .commit?.(draft?.args ?? {}, CTX);
    expect(h.transactions.create).toHaveBeenCalledWith(
      {
        itemId: 'item_1',
        type: 'WASTAGE',
        quantity: 20,
        note: 'expired: batch B123',
      },
      'org_1',
      expect.objectContaining({ actorId: 'user_1' }),
    );
  });

  it('refuses to write off an empty batch', async () => {
    const h = build();
    h.db.stockBatch.findFirst.mockResolvedValue({ ...BATCH, quantity: 0 });
    await expect(
      h.byName('record_expiry_writeoff').buildProposal?.(
        { batchId: 'batch_1' },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses an unknown batch', async () => {
    const h = build();
    h.db.stockBatch.findFirst.mockResolvedValue(null);
    await expect(
      h.byName('record_expiry_writeoff').buildProposal?.(
        { batchId: 'other' },
        CTX,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
